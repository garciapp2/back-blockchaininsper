# Backend - Blockchain Insper

API REST para administração de conteúdo do site da Blockchain Insper.

## 🚀 Funcionalidades

- **Autenticação JWT** para administradores
- **CRUD completo** para eventos e notícias
- **Upload de imagens** com validação
- **Sistema de backup** dos dados
- **Rate limiting** para segurança
- **Logs de atividade**

## 📋 Pré-requisitos

- Node.js 16+
- NPM ou Yarn

## 🔧 Instalação

1. Instalar dependências:
```bash
npm install
```

2. Configurar variáveis de ambiente:
```bash
# Copiar arquivo de configuração
cp config.env .env

# Editar as configurações conforme necessário
```

3. Iniciar servidor:
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## 🔐 Credenciais Padrão

- **Email:** admin@blockchaininsper.com.br
- **Senha:** BlockchainInsper2024!

> ⚠️ **Importante:** Altere a senha padrão após o primeiro login!

## 📚 Endpoints da API

### Autenticação
- `POST /api/auth/login` - Login do administrador
- `POST /api/auth/change-password` - Alterar senha

### Eventos (Público)
- `GET /api/eventos` - Listar eventos públicos
- `GET /api/eventos/:id` - Buscar evento específico

### Notícias (Público)
- `GET /api/noticias` - Listar notícias públicas
- `GET /api/noticias/destaques` - Notícias em destaque
- `GET /api/noticias/:id` - Buscar notícia específica

### Administração (Requer autenticação)
- `GET /api/admin/dashboard` - Estatísticas do painel
- `GET /api/admin/eventos` - Listar todos os eventos
- `GET /api/admin/noticias` - Listar todas as notícias
- `POST /api/admin/upload` - Upload de imagem
- `DELETE /api/admin/upload/:filename` - Excluir imagem
- `POST /api/admin/backup` - Criar backup

### CRUD Eventos (Admin)
- `POST /api/eventos` - Criar evento
- `PUT /api/eventos/:id` - Atualizar evento
- `DELETE /api/eventos/:id` - Excluir evento

### CRUD Notícias (Admin)
- `POST /api/noticias` - Criar notícia
- `PUT /api/noticias/:id` - Atualizar notícia
- `DELETE /api/noticias/:id` - Excluir notícia

## 🗂️ Estrutura do Projeto

```
backend/
├── data/           # Dados JSON (eventos e notícias)
├── middlewares/    # Middlewares de autenticação
├── routes/         # Rotas da API
├── uploads/        # Arquivos enviados
├── config.env      # Configurações
├── server.js       # Servidor principal
└── package.json    # Dependências
```

## 🔒 Segurança

- **Helmet** para headers de segurança
- **CORS** configurado
- **Rate limiting** por IP
- **JWT** para autenticação
- **Bcrypt** para hash de senhas
- **Validação** de tipos de arquivo

## 📊 Monitoramento

- Health check: `GET /health`
- Logs detalhados com Morgan
- Backup automático disponível

## 🚀 Deploy

1. Configurar variáveis de ambiente de produção
2. Alterar `NODE_ENV=production`
3. Configurar proxy reverso (Nginx)
4. Configurar SSL/HTTPS
5. Configurar processo manager (PM2)

## 📝 Notas

- Dados são armazenados em arquivos JSON para simplicidade
- Para produção, considere migrar para banco de dados
- Backup regular dos dados é recomendado
- Monitorar logs para atividades suspeitas
