#!/usr/bin/env bash
# batch-grammar-gen.sh — Gera módulos de gramática em batch via API
# Foco: tópicos que realmente doem pra brasileiro aprender, não trivialidades
#
# Uso: bash scripts/batch-grammar-gen.sh 2>&1 | tee logs/grammar-batch.log

set +e  # continue on errors — we track them ourselves

API="http://localhost:3000/polyglot/api/grammar"
DELAY=3  # seconds between requests to avoid rate limit
COUNT=0
ERRORS=0
SKIPPED=0

generate() {
    local id="$1" lang="$2" name="$3" cluster="$4" level="$5"
    shift 5
    local prereqs="$1"
    shift
    local examples="$1"

    # Check if already exists
    local status_code
    status_code=$(curl -s -o /dev/null -w "%{http_code}" "${API}/${id}")
    if [[ "$status_code" == "200" ]]; then
        echo "[SKIP] ${id} — já existe"
        SKIPPED=$((SKIPPED + 1))
        return
    fi

    echo -n "[GEN] ${id} ... "
    local body
    body=$(cat <<EOJSON
{
    "language": "${lang}",
    "topic_id": "${id}",
    "topic_name": "${name}",
    "cluster": "${cluster}",
    "level": "${level}",
    "prerequisite_topics": ${prereqs},
    "example_sentences": ${examples}
}
EOJSON
)

    local resp
    resp=$(curl -s -X POST "${API}/${id}" \
        -H "Content-Type: application/json" \
        -d "${body}" --max-time 180 2>&1)

    # Check if response contains an id field (= success)
    if echo "$resp" | grep -q '"id"'; then
        local title
        title=$(echo "$resp" | grep -o '"title":"[^"]*"' | head -1 | cut -d'"' -f4)
        local cost
        cost=$(echo "$resp" | grep -o '"costUsd":[0-9.]*' | head -1 | cut -d: -f2)
        echo "✅ ${title:-?} | \$${cost:-0}"
        COUNT=$((COUNT + 1))
    else
        echo "❌ ERRO: $(echo "$resp" | head -c 300)"
        ERRORS=$((ERRORS + 1))
    fi

    sleep "$DELAY"
}

echo "=========================================="
echo "  Grammar Module Batch Generation"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# ═══════════════════════════════════════════════════════════════
# GERMAN (DE) — Pain points: cases, word order, adjective endings
# Already have: KASUS_DATIV, V2_REGEL, DU_SIE
# ═══════════════════════════════════════════════════════════════

echo "━━━ 🇩🇪 DEUTSCH ━━━"

generate "DE_STRUCT_WECHSELPRAP" "DE" \
    "Wechselpräpositionen — Acusativo vs Dativo com preposições de duas vias (in, auf, an, über, unter, vor, hinter, neben, zwischen)" \
    "structure" "a2" \
    '["DE_STRUCT_KASUS_DATIV"]' \
    '[{"pt":"Eu moro na cidade.","target":"Ich wohne in der Stadt. (dativo: localização)"},{"pt":"Eu vou para a cidade.","target":"Ich gehe in die Stadt. (acusativo: direção)"}]'

generate "DE_PRECISION_ADJEKTIV" "DE" \
    "Adjektivdeklination — O sistema de declinação de adjetivos alemães (fraco, forte, misto)" \
    "precision" "a2" \
    '["DE_STRUCT_KASUS_DATIV"]' \
    '[{"pt":"O homem alto veio.","target":"Der große Mann kam."},{"pt":"Eu vejo um homem alto.","target":"Ich sehe einen großen Mann."},{"pt":"Com café quente.","target":"Mit heißem Kaffee."}]'

generate "DE_TIME_PERFEKT_PRAT" "DE" \
    "Perfekt vs Präteritum — Quando usar cada passado no alemão oral e escrito" \
    "time" "a2" \
    '[]' \
    '[{"pt":"Eu trabalhei ontem.","target":"Ich habe gestern gearbeitet. (Perfekt - oral)"},{"pt":"Eu era pequeno.","target":"Ich war klein. (Präteritum - sein/haben sempre)"}]'

generate "DE_OPINION_MODALPARTIKELN" "DE" \
    "Modalpartikeln — doch, mal, ja, halt, eben, schon — a alma da fala natural alemã" \
    "opinion" "b1" \
    '[]' \
    '[{"pt":"Vem cá! (tom suave)","target":"Komm mal her!"},{"pt":"Mas eu já te disse!","target":"Das habe ich dir doch gesagt!"},{"pt":"Isso é verdade, né.","target":"Das stimmt ja."}]'

generate "DE_STRUCT_NEBENSATZ" "DE" \
    "Nebensatz-Wortstellung — Ordem das palavras em orações subordinadas (dass, weil, ob, wenn, als)" \
    "structure" "a2" \
    '["DE_STRUCT_V2_REGEL"]' \
    '[{"pt":"Eu sei que ele vem.","target":"Ich weiß, dass er kommt. (verbo no final)"},{"pt":"Quando eu era criança...","target":"Als ich ein Kind war, ... (verbo no final da subordinada)"}]'

generate "DE_STRUCT_TRENNBARE" "DE" \
    "Trennbare Verben und Satzklammer — Verbos separáveis e a moldura da frase alemã" \
    "structure" "a1" \
    '["DE_STRUCT_V2_REGEL"]' \
    '[{"pt":"Eu ligo para você.","target":"Ich rufe dich an. (anrufen → an... vai pro final)"},{"pt":"Ela se levantou cedo.","target":"Sie stand früh auf. (aufstehen)"}]'

generate "DE_PRECISION_GENUS" "DE" \
    "Genus-Regeln — Heurísticas para adivinhar o gênero dos substantivos alemães (der/die/das)" \
    "precision" "a1" \
    '[]' \
    '[{"pt":"o carro (neutro!)","target":"das Auto"},{"pt":"a liberdade (-heit = sempre feminino)","target":"die Freiheit"},{"pt":"o computador (-er = geralmente masculino)","target":"der Computer"}]'

generate "DE_OPINION_KONJUNKTIV_II" "DE" \
    "Konjunktiv II — Subjuntivo para polidez, hipóteses e desejos (würde, hätte, könnte, wäre)" \
    "opinion" "b1" \
    '["DE_SOCIAL_DU_SIE"]' \
    '[{"pt":"O senhor poderia me ajudar?","target":"Könnten Sie mir helfen?"},{"pt":"Eu gostaria de um café.","target":"Ich hätte gern einen Kaffee."},{"pt":"Se eu fosse rico...","target":"Wenn ich reich wäre..."}]'

generate "DE_PRECISION_PRAP_VERBEN" "DE" \
    "Präpositionalergänzungen — Combinações fixas de verbo + preposição (warten auf, sich freuen über, denken an)" \
    "precision" "b1" \
    '["DE_STRUCT_KASUS_DATIV"]' \
    '[{"pt":"Eu espero por você.","target":"Ich warte auf dich. (auf+Akk, não \"für\")"},{"pt":"Eu penso em você.","target":"Ich denke an dich. (an+Akk, não \"über\")"},{"pt":"Eu me alegro com isso.","target":"Ich freue mich darüber."}]'

generate "DE_STRUCT_RELATIVSATZ" "DE" \
    "Relativsätze — Orações relativas e a escolha do pronome relativo por caso e gênero" \
    "structure" "b1" \
    '["DE_STRUCT_KASUS_DATIV", "DE_STRUCT_NEBENSATZ"]' \
    '[{"pt":"O homem que eu vi.","target":"Der Mann, den ich gesehen habe. (Akk masc)"},{"pt":"A mulher a quem eu ajudei.","target":"Die Frau, der ich geholfen habe. (Dat fem)"}]'


# ═══════════════════════════════════════════════════════════════
# JAPANESE (JA) — Pain points: particles, keigo, verb forms
# Already have: WA_GA
# ═══════════════════════════════════════════════════════════════

echo ""
echo "━━━ 🇯🇵 JAPONÊS ━━━"

generate "JA_PARTICLE_NI_DE" "JA" \
    "に vs で — Partículas de localização e meio: onde se ESTÁ vs onde se FAZ" \
    "particle" "a2" \
    '[]' \
    '[{"pt":"Eu moro em Tóquio.","target":"東京に住んでいます。(ni = local de existência)"},{"pt":"Eu estudo na biblioteca.","target":"図書館で勉強します。(de = local da ação)"}]'

generate "JA_CONNECTOR_KARA_NODE" "JA" \
    "から vs ので vs ため — Expressar razão/causa com diferentes níveis de formalidade" \
    "connector" "a2" \
    '[]' \
    '[{"pt":"Porque está chovendo, não vou sair.","target":"雨が降っているから、出かけません。(kara = casual)"},{"pt":"Como está chovendo, não saio.","target":"雨が降っているので、出かけません。(node = formal/suave)"}]'

generate "JA_SOCIAL_KEIGO_INTRO" "JA" \
    "Keigo入門 — Introdução ao sistema honorífico: 丁寧語, 尊敬語, 謙譲語" \
    "honorific" "b1" \
    '[]' \
    '[{"pt":"O professor come. (respeitoso)","target":"先生が召し上がります。(meshiagarimasu)"},{"pt":"Eu como. (humilde para superiores)","target":"いただきます。(itadakimasu)"}]'

generate "JA_STRUCTURE_TE_FORM" "JA" \
    "て形 (te-kei) — A forma-te e seus 10+ usos: progressivo, pedido, sequência, permissão" \
    "structure" "a2" \
    '[]' \
    '[{"pt":"Estou comendo agora.","target":"今食べています。(te-iru = progressivo)"},{"pt":"Por favor, espere.","target":"待ってください。(te-kudasai = pedido)"},{"pt":"Pode entrar.","target":"入ってもいいですよ。(te-mo ii = permissão)"}]'

generate "JA_STRUCTURE_CONDITIONAL" "JA" \
    "条件形 — たら vs ば vs と vs なら: as 4 condicionais do japonês e quando usar cada uma" \
    "structure" "b1" \
    '["JA_STRUCTURE_TE_FORM"]' \
    '[{"pt":"Se chover, fico em casa.","target":"雨が降ったら、家にいます。(tara = se acontecer)"},{"pt":"Se apertar esse botão, abre.","target":"このボタンを押すと、開きます。(to = resultado natural)"}]'

generate "JA_SOCIAL_AGERU_MORAU" "JA" \
    "あげる・もらう・くれる — O triângulo de dar e receber que não existe em português" \
    "social" "a2" \
    '[]' \
    '[{"pt":"Eu dei um presente para ele.","target":"彼にプレゼントをあげました。(ageru = eu dou)"},{"pt":"Ele me deu um presente.","target":"彼がプレゼントをくれました。(kureru = ele me dá)"},{"pt":"Eu recebi um presente dele.","target":"彼にプレゼントをもらいました。(morau = eu recebo)"}]'

generate "JA_STRUCTURE_PASSIVE" "JA" \
    "受身形 — Passiva direta e a temida passiva de prejuízo (迷惑の受身)" \
    "structure" "b1" \
    '["JA_STRUCTURE_TE_FORM"]' \
    '[{"pt":"Eu fui elogiado pelo professor.","target":"先生に褒められました。(passiva direta)"},{"pt":"Choveu em mim! (passiva de prejuízo)","target":"雨に降られました。(meiwaku no ukemi)"}]'

generate "JA_PARTICLE_MO_SHIKA" "JA" \
    "も vs しか vs だけ — Inclusão, exclusão e limitação: também, só, apenas" \
    "particle" "a2" \
    '["JA_PARTICLE_WA_GA"]' \
    '[{"pt":"Eu também vou.","target":"私も行きます。(mo = também)"},{"pt":"Só tenho 100 ienes.","target":"100円しかありません。(shika+neg = apenas)"}]'

generate "JA_TIME_TEIRU_TA" "JA" \
    "ている vs た — Progressivo/resultativo vs passado simples: o aspecto verbal japonês" \
    "time" "a2" \
    '["JA_STRUCTURE_TE_FORM"]' \
    '[{"pt":"Ele está casado (estado resultante).","target":"結婚しています。(te-iru = resultado que persiste)"},{"pt":"Ele casou (evento passado).","target":"結婚しました。(ta = ação concluída)"}]'

generate "JA_PRECISION_COUNTERS" "JA" \
    "助数詞 — Classificadores numéricos: 人, 匹, 本, 枚, 冊, 台 e a lógica por trás" \
    "precision" "a1" \
    '[]' \
    '[{"pt":"Três pessoas.","target":"三人 (san-nin) — nin para pessoas"},{"pt":"Dois gatos.","target":"二匹 (ni-hiki) — hiki para animais pequenos"},{"pt":"Uma garrafa.","target":"一本 (ip-pon) — hon para coisas cilíndricas"}]'


# ═══════════════════════════════════════════════════════════════
# FRENCH (FR) — Pain points: subjonctif, passé composé, pronouns
# ═══════════════════════════════════════════════════════════════

echo ""
echo "━━━ 🇫🇷 FRANÇAIS ━━━"

generate "FR_TIME_PC_IMPARFAIT" "FR" \
    "Passé composé vs Imparfait — Quando usar cada passado: ação pontual vs cenário/hábito" \
    "time" "a2" \
    '[]' \
    '[{"pt":"Eu morava em Paris (hábito/cenário).","target":"Je vivais à Paris. (imparfait)"},{"pt":"Eu me mudei para Paris (ação pontual).","target":"Je suis déménagé à Paris. (passé composé)"}]'

generate "FR_OPINION_SUBJONCTIF" "FR" \
    "Le Subjonctif — Gatilhos do subjuntivo francês: quando que + indicativo vira que + subjonctif" \
    "opinion" "b1" \
    '[]' \
    '[{"pt":"Eu quero que ele venha.","target":"Je veux qu'\''il vienne. (vouloir → subjonctif)"},{"pt":"Eu sei que ele vem.","target":"Je sais qu'\''il vient. (savoir → indicatif)"}]'

generate "FR_PARTICLE_Y_EN" "FR" \
    "Y et En — Os pronomes adverbiais que não existem em português" \
    "particle" "a2" \
    '[]' \
    '[{"pt":"Eu vou para lá.","target":"J'\''y vais. (y = à ce lieu)"},{"pt":"Eu quero (disso).","target":"J'\''en veux. (en = de cela)"},{"pt":"Eu tenho três (deles).","target":"J'\''en ai trois. (en = partitif)"}]'

generate "FR_STRUCTURE_CLITIC" "FR" \
    "Pronoms compléments — Ordem dos clíticos: me/te/se/nous/vous + le/la/les + lui/leur + y + en" \
    "structure" "b1" \
    '["FR_PARTICLE_Y_EN"]' \
    '[{"pt":"Eu te dei ele.","target":"Je te l'\''ai donné. (te antes de le)"},{"pt":"Eu lhe disse isso.","target":"Je le lui ai dit. (le antes de lui)"}]'

generate "FR_PRECISION_PARTITIF" "FR" \
    "Articles partitifs — du, de la, des vs de: quando usar o artigo partitivo e quando ele desaparece" \
    "precision" "a2" \
    '[]' \
    '[{"pt":"Eu quero pão (um pouco de).","target":"Je veux du pain. (partitif)"},{"pt":"Eu não quero pão.","target":"Je ne veux pas de pain. (de après négation)"},{"pt":"Eu quero O pão (específico).","target":"Je veux le pain. (défini)"}]'

generate "FR_TIME_CONDITIONNEL" "FR" \
    "Le Conditionnel — Polidez, hipóteses e futuro do passado: Je voudrais vs Je veux" \
    "time" "b1" \
    '[]' \
    '[{"pt":"Eu gostaria de um café.","target":"Je voudrais un café. (polidez)"},{"pt":"Se eu fosse rico, viajaria.","target":"Si j'\''étais riche, je voyagerais. (hipótese)"}]'

generate "FR_STRUCTURE_RELATIF" "FR" \
    "Pronoms relatifs — qui, que, dont, où, lequel: qual pronome relativo usar e por quê" \
    "structure" "b1" \
    '[]' \
    '[{"pt":"O livro do qual eu falei.","target":"Le livre dont j'\''ai parlé. (dont = de qui/quoi)"},{"pt":"A cidade onde eu moro.","target":"La ville où j'\''habite. (où = dans laquelle)"}]'

generate "FR_PRECISION_ACCORD_PP" "FR" \
    "Accord du participe passé — Concordância do particípio com être e com OD anteposto" \
    "precision" "b1" \
    '["FR_TIME_PC_IMPARFAIT"]' \
    '[{"pt":"Ela saiu.","target":"Elle est sortie. (être → concorda com sujeito)"},{"pt":"As flores que eu comprei.","target":"Les fleurs que j'\''ai achetées. (OD anteposto → concorda)"}]'

generate "FR_SOCIAL_REGISTRE" "FR" \
    "Registres de langue — Tu vs Vous, ne...pas vs pas, inversão vs est-ce que: formal vs informal real" \
    "social" "a1" \
    '[]' \
    '[{"pt":"O que você quer? (informal)","target":"Tu veux quoi? / Qu'\''est-ce que tu veux?"},{"pt":"O que o senhor deseja? (formal)","target":"Que désirez-vous?"}]'

generate "FR_STRUCTURE_NEGATION" "FR" \
    "La Négation — ne...pas, ne...plus, ne...jamais, ne...rien, ne...aucun e a queda do ne oral" \
    "structure" "a2" \
    '[]' \
    '[{"pt":"Eu não sei mais.","target":"Je ne sais plus. (escrito) / Je sais plus. (oral: ne cai)"},{"pt":"Eu nunca vi isso.","target":"Je n'\''ai jamais vu ça."}]'


# ═══════════════════════════════════════════════════════════════
# SPANISH (ES) — Pain points for Brazilians: ser/estar, pretérito
# ═══════════════════════════════════════════════════════════════

echo ""
echo "━━━ 🇪🇸 ESPAÑOL ━━━"

generate "ES_STRUCTURE_SER_ESTAR" "ES" \
    "Ser vs Estar — As diferenças sutis entre o sistema PT-BR e o espanhol que causam erros" \
    "structure" "a2" \
    '[]' \
    '[{"pt":"Ele é chato. (personalidade)","target":"Él es aburrido. (ser = característica)"},{"pt":"Ele está chato hoje. (estado)","target":"Él está aburrido. (estar = estado/emoção)"}]'

generate "ES_TIME_PRET_IMPERF" "ES" \
    "Pretérito indefinido vs Imperfecto — Ação pontual vs cenário passado: hablé vs hablaba" \
    "time" "a2" \
    '[]' \
    '[{"pt":"Ontem eu comi paella.","target":"Ayer comí paella. (indefinido: ação única)"},{"pt":"Quando criança, eu comia paella.","target":"De niño, comía paella. (imperfecto: hábito)"}]'

generate "ES_OPINION_SUBJUNTIVO" "ES" \
    "El Subjuntivo — Gatilhos do subjuntivo espanhol: WEIRDO (Wishes, Emotions, Impersonal, Requests, Doubt, Ojalá)" \
    "opinion" "b1" \
    '[]' \
    '[{"pt":"Eu quero que ele venha.","target":"Quiero que venga. (desejo → subjuntivo)"},{"pt":"Duvido que chova.","target":"Dudo que llueva. (dúvida → subjuntivo)"}]'

generate "ES_PRECISION_POR_PARA" "ES" \
    "Por vs Para — Causa/meio/troca vs finalidade/destino/prazo: a distinção que PT-BR não faz" \
    "precision" "a2" \
    '[]' \
    '[{"pt":"Eu estudo para o exame (finalidade).","target":"Estudio para el examen."},{"pt":"Eu estudo por curiosidade (causa).","target":"Estudio por curiosidad."},{"pt":"Paguei 10 euros por isso (troca).","target":"Pagué 10 euros por esto."}]'

generate "ES_STRUCTURE_PRONOMBRES_OI" "ES" \
    "Pronombres de OI/OD — Leísmo, laísmo e a duplicação de OI com 'a él le dije'" \
    "structure" "b1" \
    '[]' \
    '[{"pt":"Eu disse a ele.","target":"Le dije a él. (duplicação obrigatória com a+pronome)"},{"pt":"Eu o vi. / Eu a vi.","target":"Lo vi. / La vi. (OD: lo/la, não le)"}]'

generate "ES_STRUCTURE_GUSTAR" "ES" \
    "Verbos tipo gustar — A inversão sujeito-objeto: Me gusta, me encanta, me parece, me duele" \
    "structure" "a1" \
    '[]' \
    '[{"pt":"Eu gosto de café.","target":"Me gusta el café. (o café é o sujeito!)"},{"pt":"Nós gostamos de viajar.","target":"Nos gusta viajar. (não gustamos)"}]'

generate "ES_PRECISION_FALSOS_AMIGOS" "ES" \
    "Falsos amigos PT-BR↔ES — As armadilhas mortais: exquisito, embarazada, polvo, largo, oficina, vaso" \
    "precision" "a1" \
    '[]' \
    '[{"pt":"Ela está grávida. (NÃO embarazada!)","target":"Está embarazada. (= grávida, não envergonhada)"},{"pt":"Escritório (não oficina!)","target":"Oficina = escritório; Taller = oficina mecânica"}]'

generate "ES_TIME_FUTURO_IR" "ES" \
    "Futuro simple vs Ir a + infinitivo vs Presente — 3 formas de falar do futuro e quando cada uma" \
    "time" "a2" \
    '[]' \
    '[{"pt":"Amanhã vou estudar.","target":"Mañana voy a estudiar. (ir a = plano concreto)"},{"pt":"Um dia eu viajarei.","target":"Algún día viajaré. (futuro simple = previsão/promessa)"}]'

generate "ES_SOCIAL_TUTEO_VOSEO" "ES" \
    "Tú vs Vos vs Usted — O sistema de tratamento do mundo hispânico: tuteo, voseo e ustedeo" \
    "social" "a2" \
    '[]' \
    '[{"pt":"Tu vens? (Espanha)","target":"¿Tú vienes? (tuteo)"},{"pt":"Tu vens? (Argentina)","target":"¿Vos venís? (voseo)"},{"pt":"O senhor vem? (formal)","target":"¿Usted viene?"}]'

generate "ES_STRUCTURE_REFLEXIVOS" "ES" \
    "Verbos reflexivos e pronominais — Se lavar vs Lavarse: usos reflexivos, recíprocos e SE impessoal" \
    "structure" "a2" \
    '[]' \
    '[{"pt":"Eu me levanto às 7.","target":"Me levanto a las 7. (reflexivo)"},{"pt":"Aqui se fala espanhol.","target":"Aquí se habla español. (impessoal)"},{"pt":"Eles se cumprimentaram.","target":"Se saludaron. (recíproco)"}]'


# ═══════════════════════════════════════════════════════════════
# ITALIAN (IT) — Pain points: congiuntivo, passato, combined clitics
# ═══════════════════════════════════════════════════════════════

echo ""
echo "━━━ 🇮🇹 ITALIANO ━━━"

generate "IT_TIME_PP_IMPERFETTO" "IT" \
    "Passato prossimo vs Imperfetto — Perfetto vs cenário: ho mangiato vs mangiavo" \
    "time" "a2" \
    '[]' \
    '[{"pt":"Ontem comi pizza.","target":"Ieri ho mangiato la pizza. (passato prossimo)"},{"pt":"Quando criança, eu comia pizza todo dia.","target":"Da bambino, mangiavo la pizza ogni giorno. (imperfetto)"}]'

generate "IT_OPINION_CONGIUNTIVO" "IT" \
    "Il Congiuntivo — Gatilhos do subjuntivo italiano: penso che, credo che, è necessario che" \
    "opinion" "b1" \
    '[]' \
    '[{"pt":"Eu acho que ele venha.","target":"Penso che lui venga. (congiuntivo)"},{"pt":"Eu sei que ele vem.","target":"So che lui viene. (indicativo)"}]'

generate "IT_STRUCTURE_CI_NE" "IT" \
    "Ci e Ne — Pronomes que substituem lugar (ci = lá) e quantidade/origem (ne = disso/daquilo)" \
    "structure" "a2" \
    '[]' \
    '[{"pt":"Eu vou para lá.","target":"Ci vado. (ci = a quel posto)"},{"pt":"Eu quero três (deles).","target":"Ne voglio tre. (ne = di quelli)"},{"pt":"O que você acha disso?","target":"Che ne pensi? (ne = di ciò)"}]'

generate "IT_STRUCTURE_CLITICS" "IT" \
    "Pronomi combinati — Quando me lo, te la, glielo se juntam: a ordem dos clíticos italianos" \
    "structure" "b1" \
    '["IT_STRUCTURE_CI_NE"]' \
    '[{"pt":"Eu te dou ele.","target":"Te lo do. (te + lo = te lo)"},{"pt":"Eu lhe dou ele.","target":"Glielo do. (gli + lo = glielo, fusão!)"}]'

generate "IT_PRECISION_PREPOSIZIONI" "IT" \
    "Preposizioni articolate — di+il=del, a+la=alla, in+il=nel: preposições fundidas com artigos" \
    "precision" "a1" \
    '[]' \
    '[{"pt":"Do professor.","target":"Del professore. (di + il = del)"},{"pt":"Na mesa.","target":"Sul tavolo. (su + il = sul)"},{"pt":"Ao cinema.","target":"Al cinema. (a + il = al)"}]'

generate "IT_STRUCTURE_PASSIVO" "IT" \
    "Forma passiva e Si passivante — Si mangia bene qui: o 'se' italiano que muda tudo" \
    "structure" "b1" \
    '[]' \
    '[{"pt":"Aqui se come bem.","target":"Qui si mangia bene. (si passivante)"},{"pt":"Fala-se italiano.","target":"Si parla italiano. (si impersonale)"}]'

generate "IT_TIME_CONDIZIONALE" "IT" \
    "Il Condizionale — Polidez e hipóteses: vorrei vs voglio, futuro no passado" \
    "time" "b1" \
    '[]' \
    '[{"pt":"Eu gostaria de um café.","target":"Vorrei un caffè. (condizionale di cortesia)"},{"pt":"Ele disse que viria.","target":"Ha detto che sarebbe venuto. (futuro nel passato)"}]'

generate "IT_STRUCTURE_GERUNDIO" "IT" \
    "Stare + gerundio vs forma semplice — Quando usar o progressivo em italiano (sto mangiando)" \
    "structure" "a2" \
    '[]' \
    '[{"pt":"Estou comendo agora.","target":"Sto mangiando adesso. (stare + gerundio)"},{"pt":"Eu como pizza todo dia.","target":"Mangio la pizza ogni giorno. (presente simples, não sto mangiando)"}]'

generate "IT_PRECISION_ESSERE_AVERE" "IT" \
    "Essere o Avere — Qual auxiliar usar no passato prossimo: são nascido vs tenho comido" \
    "precision" "a2" \
    '[]' \
    '[{"pt":"Eu cheguei.","target":"Sono arrivato/a. (essere com verbos de movimento)"},{"pt":"Eu comi.","target":"Ho mangiato. (avere com verbos transitivos)"}]'

generate "IT_SOCIAL_FORMALE" "IT" \
    "Lei vs Tu — O tratamento formal italiano: Lei come sta? e o uso de Lei com verbo na 3ª pessoa" \
    "social" "a1" \
    '[]' \
    '[{"pt":"Como o senhor está?","target":"Come sta (Lei)? (Lei + 3ª pessoa sing)"},{"pt":"Como você está? (informal)","target":"Come stai (tu)?"}]'


# ═══════════════════════════════════════════════════════════════
# KOREAN (KO) — Pain points: particles, honorifics, verb endings
# ═══════════════════════════════════════════════════════════════

echo ""
echo "━━━ 🇰🇷 한국어 ━━━"

generate "KO_PARTICLE_EUN_NUN_I_GA" "KO" \
    "은/는 vs 이/가 — Tópico vs Sujeito: o mesmo dilema do japonês は/が mas em coreano" \
    "particle" "a2" \
    '[]' \
    '[{"pt":"Eu sou médico. (falando de mim)","target":"저는 의사입니다. (neun = tópico)"},{"pt":"Quem é médico? EU sou. (foco novo)","target":"제가 의사입니다. (ga = sujeito/foco)"}]'

generate "KO_SOCIAL_JONDAENMAL" "KO" \
    "존댓말 vs 반말 — Os 7 níveis de formalidade coreana e os 3 que você realmente precisa" \
    "honorific" "a1" \
    '[]' \
    '[{"pt":"Obrigado. (formal polido)","target":"감사합니다. (hapnida-che)"},{"pt":"Obrigado. (informal polido)","target":"고마워요. (haeyo-che)"},{"pt":"Valeu. (informal)","target":"고마워. (hae-che)"}]'

generate "KO_CONNECTOR_GO_ASEO" "KO" \
    "-고 vs -아서/어서 — Sequência simples vs causa/sequência obrigatória: e vs então/porque" \
    "connector" "a2" \
    '[]' \
    '[{"pt":"Eu como e estudo. (sequência livre)","target":"먹고 공부해요. (-go = e, ordem livre)"},{"pt":"Eu como e então saio. (sequência causal)","target":"먹어서 나가요. (-eoseo = por isso/então)"}]'

generate "KO_STRUCTURE_OBJECT_MARKERS" "KO" \
    "을/를 (objeto) vs 에/에서 (local) vs 으로 (direção/meio) — Partículas de caso essenciais" \
    "structure" "a1" \
    '[]' \
    '[{"pt":"Eu como arroz.","target":"밥을 먹어요. (eul = objeto após consoante)"},{"pt":"Eu vou para a escola.","target":"학교에 가요. (e = destino)"},{"pt":"Eu estudo na escola.","target":"학교에서 공부해요. (eseo = local da ação)"}]'

generate "KO_TIME_PAST_FUTURE" "KO" \
    "았/었 (passado) vs ㄹ/을 거예요 (futuro) vs 겠 (intenção) — Sistema temporal coreano" \
    "time" "a2" \
    '[]' \
    '[{"pt":"Eu comi.","target":"먹었어요. (-eosseoyo = passado)"},{"pt":"Eu vou comer.","target":"먹을 거예요. (-eul geoyeyo = plano futuro)"},{"pt":"Vou comer agora (decisão).","target":"먹겠습니다. (-getseumnida = intenção/decisão)"}]'

generate "KO_STRUCTURE_QUOTING" "KO" \
    "간접화법 — Discurso indireto: -다고, -라고, -냐고 — como reportar o que alguém disse" \
    "structure" "b1" \
    '[]' \
    '[{"pt":"Ele disse que vem.","target":"온다고 했어요. (-dago = citação de declaração)"},{"pt":"Ele perguntou se eu vou.","target":"가냐고 물었어요. (-nyago = citação de pergunta)"}]'

generate "KO_PRECISION_COUNTERS" "KO" \
    "수사와 단위 — Dois sistemas numéricos (sino-coreano e nativo) e classificadores (명, 개, 잔, 마리)" \
    "precision" "a1" \
    '[]' \
    '[{"pt":"Três pessoas.","target":"세 명 (se myeong = nativo + classificador)"},{"pt":"Três horas.","target":"세 시 (se si = nativo para horas)"},{"pt":"Trezentos wons.","target":"삼백 원 (sambaek won = sino-coreano para dinheiro)"}]'

generate "KO_OPINION_HEDGING" "KO" \
    "-ㄹ 것 같다 vs -나 보다 — Expressar opinião, suposição e hedging: 'parece que', 'acho que'" \
    "opinion" "b1" \
    '[]' \
    '[{"pt":"Acho que vai chover.","target":"비가 올 것 같아요. (-l geot gatayo = suposição)"},{"pt":"Parece que ele foi embora.","target":"간 것 같아요. (suposição sobre passado)"}]'

generate "KO_SOCIAL_HONORIFIC_VOCAB" "KO" \
    "높임말 어휘 — Vocabulário honorífico: 먹다→드시다, 자다→주무시다, 있다→계시다" \
    "honorific" "b1" \
    '["KO_SOCIAL_JONDAENMAL"]' \
    '[{"pt":"O professor come. (respeitoso)","target":"선생님이 드세요. (deusida = comer-HON)"},{"pt":"O avô dorme. (respeitoso)","target":"할아버지가 주무세요. (jumusida = dormir-HON)"}]'

generate "KO_STRUCTURE_NEGATION" "KO" \
    "안 vs -지 않다 vs 못 vs -지 못하다 — Negação curta vs longa, não querer vs não poder" \
    "structure" "a2" \
    '[]' \
    '[{"pt":"Eu não como. (escolha)","target":"안 먹어요. (an = negação curta, voluntária)"},{"pt":"Eu não consigo comer. (incapacidade)","target":"못 먹어요. (mot = impossibilidade)"}]'


# ═══════════════════════════════════════════════════════════════
# CHINESE (ZH) — Pain points: particles, aspects, measure words
# ═══════════════════════════════════════════════════════════════

echo ""
echo "━━━ 🇨🇳 中文 ━━━"

generate "ZH_PARTICLE_LE" "ZH" \
    "了 (le) — Os dois 了: perfectivo (verbo+了) e mudança de estado (frase+了)" \
    "particle" "a2" \
    '[]' \
    '[{"pt":"Eu comi.","target":"我吃了。(wǒ chī le = ação completada)"},{"pt":"Eu agora sei. (mudança)","target":"我知道了。(wǒ zhīdào le = nova situação)"},{"pt":"Ficou caro!","target":"太贵了！(tài guì le = change of state)"}]'

generate "ZH_STRUCTURE_BA" "ZH" \
    "把 构造 — A construção com 把 (bǎ): quando e por que o chinês antepõe o objeto" \
    "structure" "b1" \
    '[]' \
    '[{"pt":"Eu bebi o café.","target":"我把咖啡喝了。(wǒ bǎ kāfēi hē le = disposal)"},{"pt":"Coloque o livro na mesa.","target":"把书放在桌子上。(bǎ shū fàng zài zhuōzi shàng)"}]'

generate "ZH_PRECISION_CLASSIFIERS" "ZH" \
    "量词 — Classificadores/measure words: 个, 本, 条, 张, 把, 件 e como escolher o certo" \
    "precision" "a1" \
    '[]' \
    '[{"pt":"Um livro.","target":"一本书 (yì běn shū — 本 para livros)"},{"pt":"Uma pessoa.","target":"一个人 (yí gè rén — 个 genérico)"},{"pt":"Uma cadeira.","target":"一把椅子 (yì bǎ yǐzi — 把 para objetos com alça)"}]'

generate "ZH_STRUCTURE_SHI_DE" "ZH" \
    "是...的 — Enfatizando QUANDO/ONDE/COMO algo aconteceu: 'foi em Paris que eu nasci'" \
    "structure" "a2" \
    '[]' \
    '[{"pt":"Eu nasci em São Paulo.","target":"我是在圣保罗出生的。(shì...de = enfatiza que foi em SP)"},{"pt":"Quando você veio?","target":"你是什么时候来的？(shì...de = enfatiza quando)"}]'

generate "ZH_PRECISION_HUI_NENG_KEYI" "ZH" \
    "会 vs 能 vs 可以 — Três formas de 'poder/saber': habilidade aprendida vs capacidade vs permissão" \
    "precision" "a2" \
    '[]' \
    '[{"pt":"Eu sei nadar. (aprendi)","target":"我会游泳。(huì = habilidade aprendida)"},{"pt":"Eu consigo nadar 1km.","target":"我能游一公里。(néng = capacidade/conseguir)"},{"pt":"Posso entrar?","target":"可以进来吗？(kěyǐ = permissão)"}]'

generate "ZH_STRUCTURE_COMPLEMENT" "ZH" \
    "结果补语与程度补语 — Complementos de resultado (看完) e grau (吃得很快): o pós-verbo chinês" \
    "structure" "b1" \
    '[]' \
    '[{"pt":"Eu terminei de ler.","target":"我看完了。(kàn wán = ver+completar)"},{"pt":"Eu como muito rápido.","target":"我吃得很快。(chī de hěn kuài = comer+grau+rápido)"},{"pt":"Eu não consigo ver claro.","target":"我看不清楚。(kàn bu qīngchu = negação de resultado)"}]'

generate "ZH_TIME_ZAI_ZHENGZAI" "ZH" \
    "在/正在...呢 — Progressivo chinês: como dizer 'estou fazendo agora'" \
    "time" "a1" \
    '[]' \
    '[{"pt":"Estou comendo.","target":"我在吃饭（呢）。(wǒ zài chīfàn ne)"},{"pt":"Ele está dormindo.","target":"他正在睡觉。(tā zhèngzài shuìjiào)"}]'

generate "ZH_STRUCTURE_BI_COMPARISON" "ZH" \
    "比 字句 — Comparação com 比 (bǐ): A 比 B + adj, sem 'mais' e sem 'do que'" \
    "structure" "a2" \
    '[]' \
    '[{"pt":"Eu sou mais alto que ele.","target":"我比他高。(wǒ bǐ tā gāo = eu BI ele alto)"},{"pt":"Ele corre mais rápido que eu.","target":"他比我跑得快。(tā bǐ wǒ pǎo de kuài)"}]'

generate "ZH_PARTICLE_DE_THREE" "ZH" \
    "的, 得, 地 — Os três 'de' chineses: possessivo/adj, complemento de grau, advérbio" \
    "particle" "a2" \
    '[]' \
    '[{"pt":"Meu livro (posse/modificador).","target":"我的书 (wǒ de shū — 的 possessivo)"},{"pt":"Corre rápido (advérbio).","target":"快快地跑 (kuài kuài de pǎo — 地 advérbio)"},{"pt":"Come muito rápido (grau).","target":"吃得很快 (chī de hěn kuài — 得 grau)"}]'

generate "ZH_STRUCTURE_DIRECTION" "ZH" \
    "趋向补语 — Complementos de direção: 上来, 下去, 进来, 出去, 回来 — movimento + direção" \
    "structure" "b1" \
    '[]' \
    '[{"pt":"Entre! (para cá)","target":"进来！(jìn lái = entrar+vir)"},{"pt":"Saia! (para lá)","target":"出去！(chū qù = sair+ir)"},{"pt":"Subiu correndo.","target":"跑上来了。(pǎo shàng lái le = correr+subir+vir)"}]'


# ═══════════════════════════════════════════════════════════════
# RUSSIAN (RU) — Pain points: cases, aspect, motion verbs
# ═══════════════════════════════════════════════════════════════

echo ""
echo "━━━ 🇷🇺 РУССКИЙ ━━━"

generate "RU_STRUCTURE_CASES_OVERVIEW" "RU" \
    "Падежи — Visão geral dos 6 casos russos: Nominativo, Acusativo, Genitivo, Dativo, Instrumental, Prepositivo" \
    "structure" "a2" \
    '[]' \
    '[{"pt":"O livro está na mesa. (Nom+Prep)","target":"Книга на столе. (Kniga na stolé)"},{"pt":"Eu leio o livro. (Akk)","target":"Я читаю книгу. (Ya chitáyu knígu)"}]'

generate "RU_TIME_ASPECT" "RU" \
    "Вид глагола — Aspecto verbal: imperfectivo (процесс) vs perfectivo (результат) — o conceito que PT-BR não tem" \
    "time" "a2" \
    '[]' \
    '[{"pt":"Eu escrevia uma carta. (processo)","target":"Я писал письмо. (pisál = imperfectivo)"},{"pt":"Eu escrevi a carta. (completei)","target":"Я написал письмо. (napisál = perfectivo)"}]'

generate "RU_NAVIGATION_MOTION" "RU" \
    "Глаголы движения — Verbos de movimento: идти/ходить, ехать/ездить — unidirecional vs multidirecional" \
    "navigation" "b1" \
    '[]' \
    '[{"pt":"Eu vou (agora, a pé, uma direção).","target":"Я иду. (idú = uni + a pé)"},{"pt":"Eu vou regularmente (multidirecional).","target":"Я хожу. (khozhú = multi + a pé)"},{"pt":"Eu vou (de carro, uma direção).","target":"Я еду. (yédu = uni + veículo)"}]'

generate "RU_STRUCTURE_GENITIVE" "RU" \
    "Родительный падеж — Genitivo: posse, negação, quantidade, 'de' — o caso mais frequente do russo" \
    "structure" "a2" \
    '["RU_STRUCTURE_CASES_OVERVIEW"]' \
    '[{"pt":"O livro do professor.","target":"Книга учителя. (uchítelya = gen masc)"},{"pt":"Não há tempo.","target":"Нет времени. (net vrémeni = gen após нет)"},{"pt":"Copo de água.","target":"Стакан воды. (vodý = gen fem)"}]'

generate "RU_STRUCTURE_INSTRUMENTAL" "RU" \
    "Творительный падеж — Instrumental: com quem, por meio de quê, profissão — Я работаю врачом" \
    "structure" "b1" \
    '["RU_STRUCTURE_CASES_OVERVIEW"]' \
    '[{"pt":"Eu trabalho como médico.","target":"Я работаю врачом. (vrachóm = instrum)"},{"pt":"Eu escrevo com caneta.","target":"Я пишу ручкой. (rúchkoy = instrum fem)"},{"pt":"Com amigos.","target":"С друзьями. (s druz'\''yámi = instrum pl)"}]'

generate "RU_STRUCTURE_DATIVE_USE" "RU" \
    "Дательный падеж — Dativo russo: destinatário, idade, sensações (мне холодно, мне 25 лет)" \
    "structure" "b1" \
    '["RU_STRUCTURE_CASES_OVERVIEW"]' \
    '[{"pt":"Eu tenho 25 anos.","target":"Мне 25 лет. (mne = dativo para idade!)"},{"pt":"Estou com frio.","target":"Мне холодно. (mne kholódno = dativo + adv)"},{"pt":"Eu dei o livro ao amigo.","target":"Я дал книгу другу. (drúgu = dat masc)"}]'

generate "RU_PRECISION_GENDER" "RU" \
    "Род существительных — Gênero dos substantivos russos e como adivinhar pela terminação (-а/-я=fem, consoante=masc, -о/-е=neutro)" \
    "precision" "a1" \
    '[]' \
    '[{"pt":"a mesa (fem: -а)","target":"стол... Нет! Стол = masculino (consoante!)"},{"pt":"o livro (fem: -а)","target":"книга = feminino (-а)"},{"pt":"a janela (neutro: -о)","target":"окно = neutro (-о)"}]'

generate "RU_STRUCTURE_PREPOSITIONAL" "RU" \
    "Предложный падеж — Prepositivo: sobre quê (о + prep) e onde (в/на + prep) — o caso mais simples" \
    "structure" "a2" \
    '["RU_STRUCTURE_CASES_OVERVIEW"]' \
    '[{"pt":"Eu moro em Moscou.","target":"Я живу в Москве. (Moskvé = prep fem)"},{"pt":"Eu falo sobre o livro.","target":"Я говорю о книге. (o kníge = prep fem)"}]'

generate "RU_TIME_MOTION_PREFIX" "RU" \
    "Приставки движения — Prefixos dos verbos de movimento: вы-, при-, у-, за-, пере- — como mudam o sentido" \
    "time" "b1" \
    '["RU_NAVIGATION_MOTION"]' \
    '[{"pt":"Eu saí de casa.","target":"Я вышел из дома. (výshel = вы+шёл = sair)"},{"pt":"Eu cheguei.","target":"Я пришёл. (prishól = при+шёл = chegar)"},{"pt":"Eu fui embora.","target":"Я ушёл. (ushól = у+шёл = ir embora)"}]'

generate "RU_SOCIAL_FORMALITY" "RU" \
    "Ты vs Вы — Quando usar ты e когда использовать Вы: registros de formalidade no russo" \
    "social" "a1" \
    '[]' \
    '[{"pt":"Como você está? (formal)","target":"Как Вы? / Как Вы поживаете? (Vy = formal)"},{"pt":"Tudo bem? (informal)","target":"Как ты? Как дела? (ty = informal)"}]'


# ═══════════════════════════════════════════════════════════════
# ARABIC (AR) — Pain points: root system, case, verb forms
# ═══════════════════════════════════════════════════════════════

echo ""
echo "━━━ 🇸🇦 العربية ━━━"

generate "AR_MORPH_ROOT_SYSTEM" "AR" \
    "نظام الجذر — O sistema de raízes trilíteras: como 3 consoantes geram famílias inteiras de palavras" \
    "morphology" "a2" \
    '[]' \
    '[{"pt":"escrever (raiz k-t-b)","target":"كتب (kataba) → كتاب (kitāb=livro) → مكتبة (maktaba=biblioteca) → كاتب (kātib=escritor)"}]'

generate "AR_STRUCTURE_NOMINAL_VERBAL" "AR" \
    "الجملة الاسمية والفعلية — Frase nominal (sem verbo) vs frase verbal: dois tipos de sentença árabe" \
    "structure" "a1" \
    '[]' \
    '[{"pt":"O professor é alto.","target":"المدرّس طويل. (al-mudarris ṭawīl = nominal, sem verbo)"},{"pt":"O professor escreveu.","target":"كتب المدرّس. (kataba l-mudarris = verbal, verbo primeiro)"}]'

generate "AR_PRECISION_DEFINITE" "AR" \
    "ال التعريف والإضافة — Definiteness: al- para definir, ização (iḍāfa) para posse: بيت المدرّس" \
    "precision" "a1" \
    '[]' \
    '[{"pt":"O livro.","target":"الكتاب (al-kitāb = definido com al-)"},{"pt":"Um livro.","target":"كتاب (kitāb = indefinido, sem al-)"},{"pt":"O livro do professor.","target":"كتاب المدرّس (kitāb al-mudarris = iḍāfa: 1º sem al-, 2º com al-)"}]'

generate "AR_MORPH_VERB_FORMS" "AR" \
    "أوزان الفعل — Formas verbais I-X: como o padrão muda o significado (فعّل intensivo, أفعل causativo, تفاعل recíproco)" \
    "morphology" "b1" \
    '["AR_MORPH_ROOT_SYSTEM"]' \
    '[{"pt":"ele quebrou (simples, Form I)","target":"كسر (kasara)"},{"pt":"ele despedaçou (intensivo, Form II)","target":"كسّر (kassara)"},{"pt":"eles quebraram juntos (recíproco, Form VI)","target":"تكاسر (takāsara)"}]'

generate "AR_STRUCTURE_CASE_ENDINGS" "AR" \
    "الإعراب — Marcas de caso: -u (nom), -a (acus), -i (gen) — o sistema que a fala informal ignora" \
    "structure" "b1" \
    '[]' \
    '[{"pt":"O aluno escreveu. (nom)","target":"كتب الطالبُ (aṭ-ṭālibu = -u nom)"},{"pt":"Vi o aluno. (acus)","target":"رأيت الطالبَ (aṭ-ṭāliba = -a acus)"},{"pt":"Do aluno. (gen)","target":"كتاب الطالبِ (aṭ-ṭālibi = -i gen)"}]'

generate "AR_PRECISION_BROKEN_PLURAL" "AR" \
    "جمع التكسير — Plurais irregulares árabes: por que كتاب (livro) vira كتب (livros) e não *كتابات" \
    "precision" "a2" \
    '[]' \
    '[{"pt":"livro → livros","target":"كتاب → كتب (kitāb → kutub)"},{"pt":"homem → homens","target":"رجل → رجال (rajul → rijāl)"},{"pt":"casa → casas","target":"بيت → بيوت (bayt → buyūt)"}]'

generate "AR_STRUCTURE_GENDER_VERB" "AR" \
    "التذكير والتأنيث — Gênero em verbos e adjetivos: o feminino marca tudo no árabe (كتبت vs كتب)" \
    "structure" "a2" \
    '[]' \
    '[{"pt":"Ele escreveu.","target":"كتب (kataba = masc)"},{"pt":"Ela escreveu.","target":"كتبت (katabat = fem, -t no final)"},{"pt":"A porta é grande. (porta=fem!)","target":"الباب كبيرة (al-bāb kabīra = porta é fem em árabe!)"}]'

generate "AR_TIME_PAST_PRESENT" "AR" \
    "الماضي والمضارع — Passado (sufixos) vs Presente (prefixos): dois sistemas completamente diferentes" \
    "time" "a2" \
    '[]' \
    '[{"pt":"Eu escrevi.","target":"كتبتُ (katabtu = raiz+sufixo -tu)"},{"pt":"Eu escrevo.","target":"أكتب (aktubu = prefixo a- + raiz)"},{"pt":"Ela escreve.","target":"تكتب (taktubu = prefixo ta-)"}]'

generate "AR_PRECISION_PREPOSITIONS" "AR" \
    "حروف الجر — Preposições árabes: في (em), من (de), إلى (para), على (sobre), ب (com/por) e seus pronomes" \
    "precision" "a1" \
    '[]' \
    '[{"pt":"Na escola.","target":"في المدرسة (fī l-madrasa)"},{"pt":"De São Paulo.","target":"من ساو باولو (min São Paulo)"},{"pt":"Nele / com ele.","target":"فيه / به (fīhi / bihi = prep+pronome sufixo)"}]'

generate "AR_STRUCTURE_DUAL" "AR" \
    "المثنى — O número dual: nem singular nem plural — como o árabe marca 'dois de algo'" \
    "structure" "a2" \
    '[]' \
    '[{"pt":"Dois livros.","target":"كتابان (kitābāni = dual nom) / كتابين (kitābayni = dual gen/acc)"},{"pt":"Duas mãos.","target":"يدان (yadāni = dual)"}]'


# ═══════════════════════════════════════════════════════════════
# TURKISH (TR) — Pain points: vowel harmony, agglutination, evidentiality
# ═══════════════════════════════════════════════════════════════

echo ""
echo "━━━ 🇹🇷 TÜRKÇE ━━━"

generate "TR_STRUCT_VOWEL_HARMONY" "TR" \
    "Ünlü Uyumu — Harmonia vocálica: a regra que governa TODO sufixo turco (e/a, i/ı/u/ü)" \
    "structure" "a1" \
    '[]' \
    '[{"pt":"Das casas (casa=ev)","target":"evler (e→e: harmonia frontal menor)"},{"pt":"Dos carros (carro=araba)","target":"arabalar (a→a: harmonia posterior menor)"},{"pt":"Na escola (escola=okul)","target":"okulda (o→u: harmonia posterior maior)"}]'

generate "TR_STRUCT_AGGLUTINATION" "TR" \
    "Eklemeli yapı — Aglutinação: como o turco empilha sufixos para criar frases inteiras em uma palavra" \
    "structure" "a2" \
    '["TR_STRUCT_VOWEL_HARMONY"]' \
    '[{"pt":"Eu não pude vir.","target":"gelemedim (gel-e-me-di-m = vir+poder+NEG+PAST+1sg)"},{"pt":"De nossas casas.","target":"evlerimizden (ev-ler-imiz-den = casa+PL+1pl.POSS+ABL)"}]'

generate "TR_TIME_EVIDENTIALITY" "TR" \
    "-dı vs -mış — Evidencialidade: passado testemunhado vs passado reportado/inferido" \
    "time" "a2" \
    '[]' \
    '[{"pt":"Ele veio. (eu vi)","target":"Geldi. (-dı = eu presenciei)"},{"pt":"Ele veio. (me disseram/inferi)","target":"Gelmiş. (-mış = eu não vi, ouvi dizer)"},{"pt":"A comida ficou boa! (descobri agora)","target":"Yemek güzel olmuş! (-mış = surpresa/descoberta)"}]'

generate "TR_STRUCT_CASE_SUFFIXES" "TR" \
    "Hal ekleri — Sufixos de caso: -i (acusativo), -e (dativo), -de (locativo), -den (ablativo)" \
    "structure" "a2" \
    '["TR_STRUCT_VOWEL_HARMONY"]' \
    '[{"pt":"Eu vi o gato. (acus: definido)","target":"Kediyi gördüm. (-yi = acus)"},{"pt":"Eu vou para casa. (dativo)","target":"Eve gidiyorum. (-e = dativo)"},{"pt":"Eu estou em casa. (locativo)","target":"Evdeyim. (-de = locativo)"}]'

generate "TR_STRUCT_RELATIVE_CLAUSE" "TR" \
    "Sıfat-fiil — Orações relativas turcas: participial, não com pronome relativo — a lógica inversa" \
    "structure" "b1" \
    '[]' \
    '[{"pt":"O homem que eu vi.","target":"Gördüğüm adam. (gör-düğ-üm = ver+PART+1sg + homem)"},{"pt":"O livro que está na mesa.","target":"Masada duran kitap. (dur-an = estar+PART.PRES + livro)"}]'

generate "TR_TIME_PRESENT_TENSES" "TR" \
    "-yor vs -ır/-ar — Presente contínuo vs Presente geral/habitual (e aoristo)" \
    "time" "a2" \
    '[]' \
    '[{"pt":"Eu estou comendo agora.","target":"Yemek yiyorum. (-yor = agora, contínuo)"},{"pt":"Eu como arroz todo dia.","target":"Her gün pirinç yerim. (-ır/-im = geral/habitual)"}]'

generate "TR_STRUCT_POSTPOSITIONS" "TR" \
    "Son çekimli edatlar — Posposições: o turco põe depois o que português põe antes (için, ile, gibi, kadar)" \
    "structure" "a1" \
    '[]' \
    '[{"pt":"Para você.","target":"Senin için. (para = için, vem depois)"},{"pt":"Com meu amigo.","target":"Arkadaşımla. (-la/-le = com, sufixo)"},{"pt":"Como um médico.","target":"Doktor gibi. (como = gibi, depois)"}]'

generate "TR_PRECISION_POSSESSIVE" "TR" \
    "İyelik ekleri — Construções possessivas: -(i)m, -(i)n, -(s)ı e a 'izafet' turca (ev+im = minha casa)" \
    "precision" "a1" \
    '["TR_STRUCT_VOWEL_HARMONY"]' \
    '[{"pt":"Minha casa.","target":"Evim. (ev-im = casa+1sg.POSS)"},{"pt":"Sua casa. (dele)","target":"Evi / Onun evi. (ev-i = casa+3sg.POSS)"},{"pt":"A porta da casa.","target":"Evin kapısı. (ev-in kapı-sı = izafet)"}]'

generate "TR_OPINION_CONDITIONAL" "TR" \
    "-sa/-se — Condicional turca e desejos: gelseydim (se eu tivesse vindo), keşke (tomara)" \
    "opinion" "b1" \
    '[]' \
    '[{"pt":"Se eu vier...","target":"Gelirsem... (-r-se-m = aoristo+COND+1sg)"},{"pt":"Se eu tivesse vindo...","target":"Gelseydim... (-se-ydi-m = COND+PAST+1sg)"},{"pt":"Tomara que venha!","target":"Keşke gelse! (keşke + subj)"}]'

generate "TR_SOCIAL_FORMALITY" "TR" \
    "Sen vs Siz — Formalidade turca e os sufixos de polidez -sınız/-siniz" \
    "social" "a1" \
    '[]' \
    '[{"pt":"Você quer? (informal)","target":"İster misin? (sen = informal)"},{"pt":"O senhor deseja? (formal)","target":"İster misiniz? (siz = formal, -siniz)"}]'


echo ""
echo "=========================================="
echo "  RESULTADO FINAL"
echo "  Gerados: ${COUNT}"
echo "  Pulados: ${SKIPPED}"
echo "  Erros:   ${ERRORS}"
echo "  Total tentados: $((COUNT + SKIPPED + ERRORS))"
echo "=========================================="
