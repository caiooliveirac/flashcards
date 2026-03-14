import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
    const current = process.env.GENERATION_ENABLED !== "false";
    process.env.GENERATION_ENABLED = current ? "false" : "true";

    return NextResponse.json({
        enabled: !current,
        message: current ? "Generation paused" : "Generation resumed",
    });
}
