const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

const CONTATOS_FILE = path.join(__dirname, '../data/contatos.json');

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

module.exports = router;
