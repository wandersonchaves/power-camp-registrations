# Exemplo de Dockerfile para Next.js + Prisma + TailwindCSS
# Usa uma imagem base otimizada para Node.js e Next.js
FROM node:18-alpine AS builder

# Instalar PNPM globalmente
RUN npm install -g pnpm

# Definir o diretório de trabalho
WORKDIR /app

# Copiar arquivos do projeto
COPY package.json pnpm-lock.yaml ./

# Copie o diretório project.inlang para o ambiente de build
COPY project.inlang ./project.inlang

# Instalar dependências
RUN pnpm install --frozen-lockfile

# Copiar o restante dos arquivos
COPY . .

# Build da aplicação Next.js
RUN pnpm build

# Produção
FROM node:18-alpine AS runner
WORKDIR /app

# Copiar arquivos essenciais do estágio anterior
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json

# Comando de inicialização
CMD ["pnpm", "start"]