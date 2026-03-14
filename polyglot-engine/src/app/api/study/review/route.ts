import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { schedule, newFSRSState } from "@/lib/fsrs";
import { z } from "zod";
import type { Rating } from "@/lib/types";

const reviewSchema = z.object({
    cardId: z.string().min(1),
    langCode: z.string().nullable().default(null),
    rating: z.number().int().min(1).max(4),
});

export async function POST(request: NextRequest) {
    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { cardId, langCode, rating } = parsed.data;
    const now = new Date();

    // Find the latest review for this card+lang combination
    const lastReview = await prisma.review.findFirst({
        where: { cardId, langCode },
        orderBy: { reviewedAt: "desc" },
    });

    // Calculate new FSRS state
    const prevState = lastReview
        ? {
            stability: lastReview.stability,
            difficulty: lastReview.difficulty,
            due: lastReview.due,
            interval: lastReview.interval,
            reps: lastReview.reps,
            lapses: lastReview.lapses,
            state: lastReview.state as 0 | 1 | 2 | 3,
        }
        : newFSRSState();

    const nextState = schedule(prevState, rating as Rating, now);

    // Create new review record
    const review = await prisma.review.create({
        data: {
            cardId,
            langCode,
            rating,
            stability: nextState.stability,
            difficulty: nextState.difficulty,
            due: nextState.due,
            interval: nextState.interval,
            reps: nextState.reps,
            lapses: nextState.lapses,
            state: nextState.state,
            reviewedAt: now,
        },
    });

    return NextResponse.json({
        review,
        nextDue: nextState.due,
        interval: nextState.interval,
        state: nextState.state,
    });
}
