const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const { authenticateToken } = require('../middlewares/auth');

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

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email e senha são obrigatórios'
      });
    }

    const admins = await lerAdmins();
    
    // Buscar admin pelo email
    const admin = admins.find(admin => admin.email === email && admin.ativo);
    
    if (!admin) {
      return res.status(401).json({
        message: 'Credenciais inválidas'
      });
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, admin.senha);
    if (!isValidPassword) {
      return res.status(401).json({
        message: 'Credenciais inválidas'
      });
    }

    // Atualizar último login
    const adminIndex = admins.findIndex(a => a.id === admin.id);
    if (adminIndex !== -1) {
      admins[adminIndex].ultimoLogin = new Date().toISOString();
      await salvarAdmins(admins);
    }

    // Gerar JWT token
    const token = jwt.sign(
      { 
        id: admin.id, 
        email: admin.email,
        role: admin.role,
        nome: admin.nome
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );

    res.json({
      message: 'Login realizado com sucesso',
      token,
      user: {
        id: admin.id,
        nome: admin.nome,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({
      message: 'Erro interno do servidor'
    });
  }
});

// POST /api/auth/change-password - Alterar senha do usuário logado
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: 'Senha atual e nova senha são obrigatórias'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: 'A nova senha deve ter pelo menos 8 caracteres'
      });
    }

    const admins = await lerAdmins();
    const adminIndex = admins.findIndex(admin => admin.id === userId);
    
    if (adminIndex === -1) {
      return res.status(404).json({
        message: 'Usuário não encontrado'
      });
    }

    // Verificar senha atual
    const isValidPassword = await bcrypt.compare(currentPassword, admins[adminIndex].senha);
    if (!isValidPassword) {
      return res.status(401).json({
        message: 'Senha atual incorreta'
      });
    }

    // Hash da nova senha
    const senhaHash = await bcrypt.hash(newPassword, 10);
    
    admins[adminIndex].senha = senhaHash;
    admins[adminIndex].atualizadoEm = new Date().toISOString();

    const salvou = await salvarAdmins(admins);
    
    if (!salvou) {
      return res.status(500).json({
        message: 'Erro ao alterar senha'
      });
    }

    res.json({
      message: 'Senha alterada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({
      message: 'Erro interno do servidor'
    });
  }
});

// GET /api/auth/me - Obter dados do usuário logado
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const admins = await lerAdmins();
    const admin = admins.find(admin => admin.id === userId);
    
    if (!admin) {
      return res.status(404).json({
        message: 'Usuário não encontrado'
      });
    }

    res.json({
      user: {
        id: admin.id,
        nome: admin.nome,
        email: admin.email,
        role: admin.role,
        ultimoLogin: admin.ultimoLogin
      }
    });

  } catch (error) {
    console.error('Erro ao buscar dados do usuário:', error);
    res.status(500).json({
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;