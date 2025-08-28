const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');
const router = express.Router();

const NOTICIAS_FILE = path.join(__dirname, '../data/noticias.json');

// Função para ler notícias do arquivo
const lerNoticias = async () => {
  try {
    const data = await fs.readFile(NOTICIAS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler notícias:', error);
    
    // Se o arquivo não existe, criar com dados padrão
    const noticiasDefault = [];
    try {
      await fs.writeFile(NOTICIAS_FILE, JSON.stringify(noticiasDefault, null, 2));
    } catch (writeError) {
      console.error('Erro ao criar arquivo de notícias:', writeError);
    }
    
    return noticiasDefault;
  }
};

// Função para salvar notícias no arquivo
const salvarNoticias = async (noticias) => {
  try {
    await fs.writeFile(NOTICIAS_FILE, JSON.stringify(noticias, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar notícias:', error);
    return false;
  }
};

// GET /api/noticias - Listar todas as notícias públicas
router.get('/', async (req, res) => {
  try {
    const noticias = await lerNoticias();
    const noticiasPublicas = noticias.filter(noticia => noticia.ativo);
    
    // Ordenar por data (mais recentes primeiro)
    noticiasPublicas.sort((a, b) => new Date(b.data) - new Date(a.data));
    
    res.json({
      success: true,
      data: noticiasPublicas,
      total: noticiasPublicas.length
    });
  } catch (error) {
    console.error('Erro ao buscar notícias:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET /api/noticias/destaques - Listar notícias em destaque
router.get('/destaques', async (req, res) => {
  try {
    const noticias = await lerNoticias();
    const noticiasDestaque = noticias.filter(noticia => noticia.ativo && noticia.destaque);
    
    // Ordenar por data (mais recentes primeiro)
    noticiasDestaque.sort((a, b) => new Date(b.data) - new Date(a.data));
    
    res.json({
      success: true,
      data: noticiasDestaque,
      total: noticiasDestaque.length
    });
  } catch (error) {
    console.error('Erro ao buscar notícias em destaque:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET /api/noticias/:id - Buscar notícia específica
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const noticias = await lerNoticias();
    const noticia = noticias.find(n => n.id === parseInt(id) && n.ativo);
    
    if (!noticia) {
      return res.status(404).json({
        success: false,
        message: 'Notícia não encontrada'
      });
    }
    
    res.json({
      success: true,
      data: noticia
    });
  } catch (error) {
    console.error('Erro ao buscar notícia:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// POST /api/noticias - Criar nova notícia (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      titulo,
      resumo,
      conteudo,
      data,
      autor,
      categoria,
      imagem,
      link,
      destaque = false
    } = req.body;

    if (!titulo || !resumo || !conteudo || !autor || !categoria) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: titulo, resumo, conteudo, autor, categoria'
      });
    }

    const noticias = await lerNoticias();
    const novoId = Math.max(...noticias.map(n => n.id), 0) + 1;
    
    const dataNoticia = data || new Date().toISOString().split('T')[0];
    
    const novaNoticia = {
      id: novoId,
      titulo,
      resumo,
      conteudo,
      data: dataNoticia,
      dataFormatada: new Date(dataNoticia).toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      autor,
      categoria,
      imagem: imagem || 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
      link: link || '#',
      destaque,
      ativo: true,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };

    noticias.push(novaNoticia);
    const salvou = await salvarNoticias(noticias);
    
    if (!salvou) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao salvar notícia'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Notícia criada com sucesso',
      data: novaNoticia
    });
  } catch (error) {
    console.error('Erro ao criar notícia:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// PUT /api/noticias/:id - Atualizar notícia (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const noticias = await lerNoticias();
    const noticiaIndex = noticias.findIndex(n => n.id === parseInt(id));
    
    if (noticiaIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Notícia não encontrada'
      });
    }

    // Atualizar campos permitidos
    const camposPermitidos = [
      'titulo', 'resumo', 'conteudo', 'data', 'autor', 
      'categoria', 'imagem', 'link', 'destaque', 'ativo'
    ];
    
    camposPermitidos.forEach(campo => {
      if (updateData[campo] !== undefined) {
        noticias[noticiaIndex][campo] = updateData[campo];
      }
    });
    
    // Atualizar data formatada se a data foi alterada
    if (updateData.data) {
      noticias[noticiaIndex].dataFormatada = new Date(updateData.data).toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    
    noticias[noticiaIndex].atualizadoEm = new Date().toISOString();
    
    const salvou = await salvarNoticias(noticias);
    
    if (!salvou) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao salvar alterações'
      });
    }

    res.json({
      success: true,
      message: 'Notícia atualizada com sucesso',
      data: noticias[noticiaIndex]
    });
  } catch (error) {
    console.error('Erro ao atualizar notícia:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// DELETE /api/noticias/:id - Excluir notícia (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const noticias = await lerNoticias();
    const noticiaIndex = noticias.findIndex(n => n.id === parseInt(id));
    
    if (noticiaIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Notícia não encontrada'
      });
    }

    // Soft delete - marcar como inativa
    noticias[noticiaIndex].ativo = false;
    noticias[noticiaIndex].atualizadoEm = new Date().toISOString();
    
    const salvou = await salvarNoticias(noticias);
    
    if (!salvou) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao excluir notícia'
      });
    }

    res.json({
      success: true,
      message: 'Notícia excluída com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir notícia:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
