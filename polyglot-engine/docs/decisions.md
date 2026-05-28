# Decisões de Implementação — PolyGlot Engine

## Versões instaladas

| Pacote | Versão |
|--------|--------|
| next | 14.2.35 |
| react | 18.3.x |
| typescript | 5.4.x |
| tailwindcss | 3.4.x |
| framer-motion | 11.x |
| prisma / @prisma/client | 5.22.x |
| zod | 3.23.x |
| grammy | 1.x |
| concurrently | 8.x |
| tsx | 4.x |

## Decisões em lacunas da spec

### 1. Arquivo da spec
- Spec encontrada como `polyglot-engine-spec-v3.md` (não `polyglot-spec-v3.md`). Copiada para `docs/polyglot-spec-v3.md`.

### 2. PostCSS config format
- Spec não define formato. Usado `postcss.config.js` com ESM export (compatível com Tailwind 3.4).

### 3. Rede Docker
- Gateway oficial atual roda em nginx no host (systemd).
- `repo-nginx-1` e fluxo containerizado ficam apenas como fallback legado controlado.
- Deploy da app continua em Docker, preferindo upstream host-bound (`127.0.0.1:porta`) no gateway.

### 4. Next.js security advisory
- Next.js 14.2.x tem 2 advisories (GHSA-9g9p / GHSA-h25m), fix só em 16+. Ambas são DoS (não RCE) e app é pessoal. Mitigação: não usar Image Optimizer remotePatterns, RSC seguro. Documentado aqui, aceito o risco.

### 5. TSV parser — campo nivel_categoria
- Spec não mostra formato exato do campo 6 do TSV. Assumido `nivel_categoria` (ex: `a1_pedido`), split por `_` no primeiro char.

### 6. FSRS implementation
- Implementação baseada nos pesos FSRS-5 com 19 parâmetros. Sem port de lib externa — implementação própria conforme spec.

### 7. Daemon no Docker
- Spec seção 4.3 mostra entrypoint com Next.js + daemon. Criado `entrypoint.sh` que roda `prisma migrate deploy`, depois `node server.js` (standalone) + `node src/daemon/index.js` em paralelo.

## Conflitos encontrados

Nenhum conflito direto entre spec e bootstrap prompt.
