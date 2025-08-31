const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

const CONTATOS_FILE = path.join(__dirname, '../data/contatos.json');
const MENSAGENS_FILE = path.join(__dirname, '../data/mensagens.json');

// Função para ler contatos do arquivo
const lerContatos = async () => {
  try {
    const data = await fs.readFile(CONTATOS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler contatos:', error);
    
    // Se o arquivo não existe, criar com dados padrão
    const contatosDefault = {
      email: "contato@blockchaininsper.com.br",
      telefone: "(11) 3000-0000",
      endereco: "Rua Quatá, 300 - Vila Olímpia, São Paulo - SP, 04546-042",
      horarioFuncionamento: "Segunda a Sexta: 8h às 18h",
      redesSociais: {
        linkedin: "https://linkedin.com/company/blockchain-insper",
        instagram: "https://instagram.com/blockchaininsper",
        twitter: "https://twitter.com/blockchaininsper"
      },
      atualizadoEm: new Date().toISOString()
    };
    
    try {
      await fs.writeFile(CONTATOS_FILE, JSON.stringify(contatosDefault, null, 2));
    } catch (writeError) {
      console.error('Erro ao criar arquivo de contatos:', writeError);
    }
    
    return contatosDefault;
  }
};

// Função para salvar contatos no arquivo
const salvarContatos = async (contatos) => {
  try {
    await fs.writeFile(CONTATOS_FILE, JSON.stringify(contatos, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar contatos:', error);
    return false;
  }
};

// Função para ler mensagens do arquivo
const lerMensagens = async () => {
  try {
    const data = await fs.readFile(MENSAGENS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler mensagens:', error);
    return [];
  }
};

// Função para salvar mensagens no arquivo
const salvarMensagens = async (mensagens) => {
  try {
    await fs.writeFile(MENSAGENS_FILE, JSON.stringify(mensagens, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar mensagens:', error);
    return false;
  }
};

// GET /api/contatos - Buscar informações de contato (público)
router.get('/', async (req, res) => {
  try {
    const contatos = await lerContatos();
    
    res.json({
      success: true,
      data: contatos
    });
  } catch (error) {
    console.error('Erro ao buscar contatos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// PUT /api/contatos - Atualizar informações de contato (Admin only)
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      email,
      telefone,
      endereco,
      horarioFuncionamento,
      redesSociais
    } = req.body;

    // Validações básicas
    if (!email || !telefone || !endereco) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: email, telefone, endereco'
      });
    }

    const contatosAtualizados = {
      email,
      telefone,
      endereco,
      horarioFuncionamento: horarioFuncionamento || 'Segunda a Sexta: 8h às 18h',
      redesSociais: redesSociais || {},
      atualizadoEm: new Date().toISOString()
    };

    const salvou = await salvarContatos(contatosAtualizados);
    
    if (!salvou) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao salvar informações de contato'
      });
    }

    res.json({
      success: true,
      message: 'Informações de contato atualizadas com sucesso',
      data: contatosAtualizados
    });
  } catch (error) {
    console.error('Erro ao atualizar contatos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// POST /api/contatos/mensagem - Enviar mensagem de contato (público)
router.post('/mensagem', async (req, res) => {
  try {
    const { nome, email, mensagem } = req.body;

    // Validações básicas
    if (!nome || !email || !mensagem) {
      return res.status(400).json({
        success: false,
        message: 'Todos os campos são obrigatórios: nome, email, mensagem'
      });
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de email inválido'
      });
    }

    // Salvar a mensagem
    const mensagens = await lerMensagens();
    const novoId = Math.max(...mensagens.map(m => m.id || 0), 0) + 1;
    
    const novaMensagem = {
      id: novoId,
      nome,
      email,
      mensagem,
      dataEnvio: new Date().toISOString(),
      lida: false,
      respondida: false
    };

    mensagens.push(novaMensagem);
    const salvou = await salvarMensagens(mensagens);
    
    if (!salvou) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao salvar mensagem'
      });
    }

    console.log('Nova mensagem de contato recebida e salva:', novaMensagem);

    res.json({
      success: true,
      message: 'Mensagem enviada com sucesso! Entraremos em contato em breve.',
      data: {
        id: novoId,
        nome,
        email,
        enviadoEm: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Erro ao processar mensagem de contato:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET /api/contatos/mensagens - Listar mensagens (Admin only)
router.get('/mensagens', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const mensagens = await lerMensagens();
    
    // Ordenar por data mais recente primeiro
    const mensagensOrdenadas = mensagens.sort((a, b) => new Date(b.dataEnvio) - new Date(a.dataEnvio));
    
    res.json({
      success: true,
      data: mensagensOrdenadas
    });
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// PUT /api/contatos/mensagens/:id - Marcar mensagem como lida/respondida (Admin only)
router.put('/mensagens/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { lida, respondida } = req.body;
    
    const mensagens = await lerMensagens();
    const mensagemIndex = mensagens.findIndex(m => m.id === parseInt(id));
    
    if (mensagemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Mensagem não encontrada'
      });
    }
    
    if (typeof lida === 'boolean') {
      mensagens[mensagemIndex].lida = lida;
    }
    if (typeof respondida === 'boolean') {
      mensagens[mensagemIndex].respondida = respondida;
    }
    
    mensagens[mensagemIndex].atualizadaEm = new Date().toISOString();
    
    const salvou = await salvarMensagens(mensagens);
    
    if (!salvou) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao atualizar mensagem'
      });
    }
    
    res.json({
      success: true,
      message: 'Mensagem atualizada com sucesso',
      data: mensagens[mensagemIndex]
    });
  } catch (error) {
    console.error('Erro ao atualizar mensagem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// DELETE /api/contatos/mensagens/:id - Excluir mensagem (Admin only)
router.delete('/mensagens/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const mensagens = await lerMensagens();
    const mensagemIndex = mensagens.findIndex(m => m.id === parseInt(id));
    
    if (mensagemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Mensagem não encontrada'
      });
    }
    
    const mensagemRemovida = mensagens.splice(mensagemIndex, 1)[0];
    const salvou = await salvarMensagens(mensagens);
    
    if (!salvou) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao excluir mensagem'
      });
    }
    
    res.json({
      success: true,
      message: 'Mensagem excluída com sucesso',
      data: mensagemRemovida
    });
  } catch (error) {
    console.error('Erro ao excluir mensagem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
