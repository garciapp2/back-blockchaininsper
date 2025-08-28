const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

const ADMINS_FILE = path.join(__dirname, '../data/admins.json');

// Função para ler administradores do arquivo
const lerAdmins = async () => {
  try {
    const data = await fs.readFile(ADMINS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler administradores:', error);
    
    // Se o arquivo não existe, criar com admin padrão
    const adminDefault = [{
      id: 1,
      nome: "Administrador Principal",
      email: process.env.ADMIN_EMAIL || "admin@blockchaininsper.com.br",
      senha: await bcrypt.hash(process.env.ADMIN_PASSWORD || "BlockchainInsper2024!", 10),
      role: "super_admin",
      ativo: true,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      ultimoLogin: null
    }];
    
    try {
      await fs.writeFile(ADMINS_FILE, JSON.stringify(adminDefault, null, 2));
    } catch (writeError) {
      console.error('Erro ao criar arquivo de administradores:', writeError);
    }
    
    return adminDefault;
  }
};

// Função para salvar administradores no arquivo
const salvarAdmins = async (admins) => {
  try {
    await fs.writeFile(ADMINS_FILE, JSON.stringify(admins, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar administradores:', error);
    return false;
  }
};

// GET /api/admins - Listar todos os administradores (Super Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const admins = await lerAdmins();
    
    // Remover senhas da resposta
    const adminsPublicos = admins.map(admin => ({
      id: admin.id,
      nome: admin.nome,
      email: admin.email,
      role: admin.role,
      ativo: admin.ativo,
      criadoEm: admin.criadoEm,
      atualizadoEm: admin.atualizadoEm,
      ultimoLogin: admin.ultimoLogin
    }));
    
    res.json({
      success: true,
      data: adminsPublicos,
      total: adminsPublicos.length
    });
  } catch (error) {
    console.error('Erro ao buscar administradores:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// POST /api/admins - Criar novo administrador (Super Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      nome,
      email,
      senha,
      role = 'admin'
    } = req.body;

    // Validações básicas
    if (!nome || !email || !senha) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: nome, email, senha'
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

    // Validar força da senha
    if (senha.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'A senha deve ter pelo menos 8 caracteres'
      });
    }

    const admins = await lerAdmins();
    
    // Verificar se email já existe
    const emailExiste = admins.find(admin => admin.email === email);
    if (emailExiste) {
      return res.status(400).json({
        success: false,
        message: 'Já existe um administrador com este email'
      });
    }

    // Gerar novo ID
    const novoId = Math.max(...admins.map(a => a.id), 0) + 1;
    
    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);
    
    const novoAdmin = {
      id: novoId,
      nome,
      email,
      senha: senhaHash,
      role,
      ativo: true,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      ultimoLogin: null
    };

    admins.push(novoAdmin);
    const salvou = await salvarAdmins(admins);
    
    if (!salvou) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao salvar administrador'
      });
    }

    // Retornar admin sem a senha
    const { senha: _, ...adminPublico } = novoAdmin;

    res.status(201).json({
      success: true,
      message: 'Administrador criado com sucesso',
      data: adminPublico
    });
  } catch (error) {
    console.error('Erro ao criar administrador:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// PUT /api/admins/:id - Atualizar administrador (Super Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nome,
      email,
      role,
      ativo
    } = req.body;

    const admins = await lerAdmins();
    const adminIndex = admins.findIndex(admin => admin.id === parseInt(id));
    
    if (adminIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Administrador não encontrado'
      });
    }

    // Não permitir desativar o último super_admin
    if (admins[adminIndex].role === 'super_admin' && ativo === false) {
      const superAdminsAtivos = admins.filter(admin => 
        admin.role === 'super_admin' && admin.ativo && admin.id !== parseInt(id)
      );
      
      if (superAdminsAtivos.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Não é possível desativar o último super administrador'
        });
      }
    }

    // Verificar se email já existe (se foi alterado)
    if (email && email !== admins[adminIndex].email) {
      const emailExiste = admins.find(admin => admin.email === email && admin.id !== parseInt(id));
      if (emailExiste) {
        return res.status(400).json({
          success: false,
          message: 'Já existe um administrador com este email'
        });
      }
    }

    // Atualizar campos
    if (nome) admins[adminIndex].nome = nome;
    if (email) admins[adminIndex].email = email;
    if (role) admins[adminIndex].role = role;
    if (typeof ativo === 'boolean') admins[adminIndex].ativo = ativo;
    
    admins[adminIndex].atualizadoEm = new Date().toISOString();

    const salvou = await salvarAdmins(admins);
    
    if (!salvou) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao atualizar administrador'
      });
    }

    // Retornar admin sem a senha
    const { senha: _, ...adminPublico } = admins[adminIndex];

    res.json({
      success: true,
      message: 'Administrador atualizado com sucesso',
      data: adminPublico
    });
  } catch (error) {
    console.error('Erro ao atualizar administrador:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// DELETE /api/admins/:id - Excluir administrador (Super Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const admins = await lerAdmins();
    const adminIndex = admins.findIndex(admin => admin.id === parseInt(id));
    
    if (adminIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Administrador não encontrado'
      });
    }

    // Não permitir excluir o último super_admin
    if (admins[adminIndex].role === 'super_admin') {
      const superAdminsAtivos = admins.filter(admin => 
        admin.role === 'super_admin' && admin.id !== parseInt(id)
      );
      
      if (superAdminsAtivos.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Não é possível excluir o último super administrador'
        });
      }
    }

    // Remover administrador
    admins.splice(adminIndex, 1);

    const salvou = await salvarAdmins(admins);
    
    if (!salvou) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao excluir administrador'
      });
    }

    res.json({
      success: true,
      message: 'Administrador excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir administrador:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// PUT /api/admins/:id/password - Alterar senha do administrador
router.put('/:id/password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { novaSenha } = req.body;

    // Validar senha
    if (!novaSenha || novaSenha.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'A nova senha deve ter pelo menos 8 caracteres'
      });
    }

    const admins = await lerAdmins();
    const adminIndex = admins.findIndex(admin => admin.id === parseInt(id));
    
    if (adminIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Administrador não encontrado'
      });
    }

    // Hash da nova senha
    const senhaHash = await bcrypt.hash(novaSenha, 10);
    
    admins[adminIndex].senha = senhaHash;
    admins[adminIndex].atualizadoEm = new Date().toISOString();

    const salvou = await salvarAdmins(admins);
    
    if (!salvou) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao alterar senha'
      });
    }

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
