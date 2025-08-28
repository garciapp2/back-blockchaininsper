const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');
const router = express.Router();

const EVENTOS_FILE = path.join(__dirname, '../data/eventos.json');

// Função para ler eventos do arquivo
const lerEventos = async () => {
  try {
    const data = await fs.readFile(EVENTOS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler eventos:', error);
    
    // Se o arquivo não existe, criar com dados padrão
    const eventosDefault = [];
    try {
      await fs.writeFile(EVENTOS_FILE, JSON.stringify(eventosDefault, null, 2));
    } catch (writeError) {
      console.error('Erro ao criar arquivo de eventos:', writeError);
    }
    
    return eventosDefault;
  }
};

// Função para salvar eventos no arquivo
const salvarEventos = async (eventos) => {
  try {
    await fs.writeFile(EVENTOS_FILE, JSON.stringify(eventos, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar eventos:', error);
    return false;
  }
};

// GET /api/eventos - Listar todos os eventos públicos
router.get('/', async (req, res) => {
  try {
    const eventos = await lerEventos();
    const eventosPublicos = eventos.filter(evento => evento.ativo);
    
    res.json({
      success: true,
      data: eventosPublicos,
      total: eventosPublicos.length
    });
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET /api/eventos/:id - Buscar evento específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const eventos = await lerEventos();
    const evento = eventos.find(e => e.id === parseInt(id) && e.ativo);
    
    if (!evento) {
      return res.status(404).json({
        success: false,
        message: 'Evento não encontrado'
      });
    }
    
    res.json({
      success: true,
      data: evento
    });
  } catch (error) {
    console.error('Erro ao buscar evento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// POST /api/eventos - Criar novo evento (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      titulo,
      descricao,
      data,
      local,
      participantes,
      categoria,
      imagem,
      destaque = false
    } = req.body;

    if (!titulo || !descricao || !data || !local || !categoria) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: titulo, descricao, data, local, categoria'
      });
    }

    const eventos = await lerEventos();
    const novoId = Math.max(...eventos.map(e => e.id), 0) + 1;
    
    const novoEvento = {
      id: novoId,
      titulo,
      descricao,
      data,
      dataFormatada: new Date(data).toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      local,
      participantes: participantes || '0',
      categoria,
      imagem: imagem || 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
      destaque,
      ativo: true,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };

    eventos.push(novoEvento);
    const salvou = await salvarEventos(eventos);
    
    if (!salvou) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao salvar evento'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Evento criado com sucesso',
      data: novoEvento
    });
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// PUT /api/eventos/:id - Atualizar evento (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const eventos = await lerEventos();
    const eventoIndex = eventos.findIndex(e => e.id === parseInt(id));
    
    if (eventoIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Evento não encontrado'
      });
    }

    // Atualizar campos permitidos
    const camposPermitidos = [
      'titulo', 'descricao', 'data', 'local', 'participantes', 
      'categoria', 'imagem', 'destaque', 'ativo'
    ];
    
    camposPermitidos.forEach(campo => {
      if (updateData[campo] !== undefined) {
        eventos[eventoIndex][campo] = updateData[campo];
      }
    });
    
    // Atualizar data formatada se a data foi alterada
    if (updateData.data) {
      eventos[eventoIndex].dataFormatada = new Date(updateData.data).toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    
    eventos[eventoIndex].atualizadoEm = new Date().toISOString();
    
    const salvou = await salvarEventos(eventos);
    
    if (!salvou) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao salvar alterações'
      });
    }

    res.json({
      success: true,
      message: 'Evento atualizado com sucesso',
      data: eventos[eventoIndex]
    });
  } catch (error) {
    console.error('Erro ao atualizar evento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// DELETE /api/eventos/:id - Excluir evento (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const eventos = await lerEventos();
    const eventoIndex = eventos.findIndex(e => e.id === parseInt(id));
    
    if (eventoIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Evento não encontrado'
      });
    }

    // Soft delete - marcar como inativo
    eventos[eventoIndex].ativo = false;
    eventos[eventoIndex].atualizadoEm = new Date().toISOString();
    
    const salvou = await salvarEventos(eventos);
    
    if (!salvou) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao excluir evento'
      });
    }

    res.json({
      success: true,
      message: 'Evento excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir evento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
