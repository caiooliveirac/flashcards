#!/bin/bash
# resume-polyglot.sh — Quick status check and restart menu for Polyglot Flashcards

set -euo pipefail

cd /home/ubuntu/flashcards/polyglot-engine

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🎴 Polyglot Flashcards — Resumo"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Docker status
echo "🐳 Docker status..."
if docker ps | grep -q polyglot-app; then
    echo "   ✅ Container polyglot-app rodando"
    APP_STATUS="running"
else
    echo "   ⚠️  Container polyglot-app não está rodando"
    APP_STATUS="stopped"
fi

echo ""

# Check grammar modules
echo "📖 Grammar modules..."
GRAMMAR_COUNT=$(docker exec polyglot-app curl -s http://localhost:3000/polyglot/api/grammar 2>/dev/null | grep -o '"total":[0-9]*' | cut -d: -f2 || echo "?")
echo "   Total: $GRAMMAR_COUNT módulos"

echo ""

# Check card enrichment
echo "💎 Card enrichment..."
cd /home/ubuntu/flashcards/polyglot-engine
STATS=$(docker exec polyglot-app npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const total = await p.card.count();
  const enriched = await p.card.count({ where: { quality: 'enriched' } });
  console.log(total + ':' + enriched);
  await p.\$disconnect();
}
main();
" 2>/dev/null || echo "?:?")

TOTAL=$(echo $STATS | cut -d: -f1)
ENRICHED=$(echo $STATS | cut -d: -f2)
REMAINING=$((TOTAL - ENRICHED))

echo "   Total: $TOTAL"
echo "   Enriched: $ENRICHED ($(echo "scale=0; 100*$ENRICHED/$TOTAL" | bc)%)"
echo "   Remaining: $REMAINING"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$REMAINING" -gt 0 ]; then
    echo "⚡ Opções disponíveis:"
    echo ""
    echo "1️⃣  Retomar enriquecimento (foreground)"
    echo "   $ npx tsx scripts/enrich-insights.ts"
    echo ""
    echo "2️⃣  Retomar enriquecimento (background)"
    echo "   $ nohup npx tsx scripts/enrich-insights.ts > logs/enrich-\$(date +%Y%m%d-%H%M%S).log 2>&1 &"
    echo ""
    echo "3️⃣  Monitorar último log"
    echo "   $ tail -f logs/enrich-insights-*.log"
    echo ""
fi

echo ""
echo "📍 Git status:"
git status --short 2>/dev/null | head -3 || echo "   (nenhuma mudança)"
echo ""
echo "📋 Última commit:"
git log -1 --oneline 2>/dev/null || echo "   (sem commits)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Para detalhes, veja: RESUMO_RETOMADA.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
