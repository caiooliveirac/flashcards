import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ─── Grammar Module Generation Prompt (cached) ─────────────

const GRAMMAR_PROMPT = (() => {
    const paths = [
        join(process.cwd(), "data", "grammar-module-prompt.txt"),
        join(process.cwd(), "src", "data", "grammar-module-prompt.txt"),
    ];
    for (const p of paths) {
        try { return readFileSync(p, "utf-8"); } catch { /* next */ }
    }
    return "";
})();

// ─── GET: Fetch a grammar module by ID ──────────────────────

export async function GET(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    const { id } = params;

    const module = await prisma.grammarModule.findUnique({
        where: { id },
        include: {
            cardLinks: {
                include: { card: { select: { id: true, seq: true, frentePt: true } } },
            },
        },
    });

    if (!module) {
        return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    return NextResponse.json(module);
}

// ─── POST: Generate a grammar module on-demand via Opus ─────

interface GenerateRequest {
    language: string;
    topic_id: string;
    topic_name: string;
    cluster: string;
    level?: string;
    prerequisite_topics?: string[];
    example_sentences?: { pt: string; target: string }[];
}

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const moduleId = params.id;

    // Check if already exists
    const existing = await prisma.grammarModule.findUnique({ where: { id: moduleId } });
    if (existing) {
        return NextResponse.json(existing);
    }

    // Parse request body
    let body: GenerateRequest;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    if (!GRAMMAR_PROMPT) {
        return NextResponse.json({ error: "Grammar prompt not found" }, { status: 500 });
    }

    // Build user prompt
    const userPrompt = buildUserPrompt(body, moduleId);

    // Call Opus
    const start = Date.now();
    let rawContent: string;
    let usage = { input_tokens: 0, output_tokens: 0, cache_read: 0, cache_create: 0 };

    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-beta": "prompt-caching-2024-07-31",
            },
            body: JSON.stringify({
                model: "claude-opus-4-6",
                max_tokens: 8192,
                temperature: 0.4,
                system: [
                    {
                        type: "text",
                        text: GRAMMAR_PROMPT,
                        cache_control: { type: "ephemeral" },
                    },
                ],
                messages: [{ role: "user", content: userPrompt }],
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error("[grammar-gen] Opus error:", response.status, errBody);
            return NextResponse.json(
                { error: `Opus API error: ${response.status}` },
                { status: 502 }
            );
        }

        const result = await response.json();
        rawContent = result.content?.[0]?.text ?? "";
        usage = {
            input_tokens: result.usage?.input_tokens ?? 0,
            output_tokens: result.usage?.output_tokens ?? 0,
            cache_read: result.usage?.cache_read_input_tokens ?? 0,
            cache_create: result.usage?.cache_creation_input_tokens ?? 0,
        };
    } catch (err) {
        console.error("[grammar-gen] Opus call failed:", err);
        return NextResponse.json({ error: "Failed to call Opus" }, { status: 502 });
    }

    const durationMs = Date.now() - start;

    // Parse JSON from Opus response
    let parsed: Record<string, unknown>;
    try {
        const cleaned = rawContent.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
        parsed = JSON.parse(cleaned);
    } catch (err) {
        console.error("[grammar-gen] JSON parse failed:", err, rawContent.slice(0, 500));
        return NextResponse.json(
            { error: "Failed to parse Opus response", raw: rawContent.slice(0, 1000) },
            { status: 502 }
        );
    }

    // Calculate cost
    const costInput = usage.input_tokens * 15 / 1_000_000;
    const costCachedRead = usage.cache_read * 1.5 / 1_000_000;
    const costCachedWrite = usage.cache_create * 18.75 / 1_000_000;
    const costOutput = usage.output_tokens * 75 / 1_000_000;
    const totalCost = costInput + costCachedRead + costCachedWrite + costOutput;

    // Store in database
    const module = await prisma.grammarModule.create({
        data: {
            id: moduleId,
            language: body.language,
            cluster: body.cluster,
            title: (parsed.title as string) || body.topic_name,
            subtitle: (parsed.subtitle as string) || null,
            level: (parsed.level as string) || body.level || "a2",
            content: parsed.sections as object || parsed,
            prerequisites: body.prerequisite_topics || [],
            relatedCardIds: [],
            status: "generated",
            sourceModel: "claude-opus-4-6",
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            cachedTokens: usage.cache_read,
            costUsd: totalCost,
        },
    });

    console.log(
        `[grammar-gen] ✅ ${moduleId} created in ${durationMs}ms | ` +
        `in=${usage.input_tokens} out=${usage.output_tokens} cache=${usage.cache_read} | $${totalCost.toFixed(4)}`
    );

    return NextResponse.json(module, { status: 201 });
}

// ─── Helpers ────────────────────────────────────────────────

function buildUserPrompt(body: GenerateRequest, moduleId: string): string {
    const parts = [
        `Generate a complete grammar module for:`,
        ``,
        `Language: ${body.language}`,
        `Module ID: ${moduleId}`,
        `Topic: ${body.topic_name}`,
        `Cluster: ${body.cluster}`,
        `Level: ${body.level || "a2"}`,
    ];

    if (body.prerequisite_topics?.length) {
        parts.push(`Prerequisites: ${body.prerequisite_topics.join(", ")}`);
    }

    if (body.example_sentences?.length) {
        parts.push(``, `Example sentences from flashcards:`);
        for (const s of body.example_sentences) {
            parts.push(`  PT: "${s.pt}" → ${body.language}: "${s.target}"`);
        }
    }

    parts.push(
        ``,
        `The module must contain all 6 sections as specified: insight, mechanism, trap, anchor, exercises (4-5), and related_cards (empty array).`,
        `All explanatory text must be in PT-BR. Target language examples must include both original script and romanization for non-Latin scripts.`
    );

    return parts.join("\n");
}
