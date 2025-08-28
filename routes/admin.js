const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');

// Função utilitária para ler JSON com tratamento de erro
async function readJsonFile(filePath, defaultValue = []) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Erro ao ler/parsear ${filePath}:`, error);
    
    // Se o arquivo não existe ou está corrompido, criar um novo
    console.log(`Recriando arquivo ${filePath} com valor padrão`);
    await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
    return defaultValue;
  }
}
const router = express.Router();

// Configuração do multer para upload de imagens
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    cb(null, `${timestamp}-${Math.random().toString(36).substr(2, 9)}${extension}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,image/webp').split(',');
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'), false);
    }
  }
});

// GET /api/admin/dashboard - Dashboard com estatísticas
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const eventosData = await fs.readFile(path.join(__dirname, '../data/eventos.json'), 'utf8');
    const noticiasData = await fs.readFile(path.join(__dirname, '../data/noticias.json'), 'utf8');
    
    const eventos = JSON.parse(eventosData);
    const noticias = JSON.parse(noticiasData);
    
    const stats = {
      eventos: {
        total: eventos.filter(e => e.ativo).length,
        destaques: eventos.filter(e => e.ativo && e.destaque).length,
        recentes: eventos.filter(e => {
          const eventoDate = new Date(e.data);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return e.ativo && eventoDate >= thirtyDaysAgo;
        }).length
      },
      noticias: {
        total: noticias.filter(n => n.ativo).length,
        destaques: noticias.filter(n => n.ativo && n.destaque).length,
        recentes: noticias.filter(n => {
          const noticiaDate = new Date(n.data);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return n.ativo && noticiaDate >= thirtyDaysAgo;
        }).length
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET /api/admin/eventos - Listar todos os eventos (incluindo inativos)
router.get('/eventos', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const eventosPath = path.join(__dirname, '../data/eventos.json');
    const eventos = await readJsonFile(eventosPath, []);
    
    // Ordenar por data de criação (mais recentes primeiro)
    eventos.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
    
    res.json({
      success: true,
      data: eventos,
      total: eventos.length
    });
  } catch (error) {
    console.error('Erro ao buscar eventos para admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET /api/admin/noticias - Listar todas as notícias (incluindo inativas)
router.get('/noticias', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const noticiasData = await fs.readFile(path.join(__dirname, '../data/noticias.json'), 'utf8');
    const noticias = JSON.parse(noticiasData);
    
    // Ordenar por data de criação (mais recentes primeiro)
    noticias.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
    
    res.json({
      success: true,
      data: noticias,
      total: noticias.length
    });
  } catch (error) {
    console.error('Erro ao buscar notícias para admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// POST /api/admin/upload - Upload de imagem
router.post('/upload', authenticateToken, requireAdmin, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo enviado'
      });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    
    res.json({
      success: true,
      message: 'Imagem enviada com sucesso',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        url: imageUrl
      }
    });
  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// DELETE /api/admin/upload/:filename - Excluir imagem
router.delete('/upload/:filename', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../uploads', filename);
    
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      
      res.json({
        success: true,
        message: 'Imagem excluída com sucesso'
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado'
      });
    }
  } catch (error) {
    console.error('Erro ao excluir imagem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// POST /api/admin/backup - Criar backup dos dados
router.post('/backup', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '../backups');
    
    // Criar diretório de backup se não existir
    try {
      await fs.access(backupDir);
    } catch {
      await fs.mkdir(backupDir, { recursive: true });
    }
    
    // Ler dados atuais
    const eventosData = await fs.readFile(path.join(__dirname, '../data/eventos.json'), 'utf8');
    const noticiasData = await fs.readFile(path.join(__dirname, '../data/noticias.json'), 'utf8');
    
    const backup = {
      timestamp: new Date().toISOString(),
      eventos: JSON.parse(eventosData),
      noticias: JSON.parse(noticiasData)
    };
    
    const backupFilename = `backup-${timestamp}.json`;
    const backupPath = path.join(backupDir, backupFilename);
    
    await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));
    
    res.json({
      success: true,
      message: 'Backup criado com sucesso',
      data: {
        filename: backupFilename,
        timestamp: backup.timestamp
      }
    });
  } catch (error) {
    console.error('Erro ao criar backup:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET /api/admin/backups - Listar backups disponíveis
router.get('/backups', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const backupDir = path.join(__dirname, '../backups');
    
    try {
      await fs.access(backupDir);
    } catch {
      return res.json({
        success: true,
        data: [],
        message: 'Nenhum backup encontrado'
      });
    }
    
    const files = await fs.readdir(backupDir);
    const backupFiles = files
      .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
      .map(file => {
        const timestamp = file.replace('backup-', '').replace('.json', '');
        
        // Tentar diferentes formatos de parsing
        let parsedDate;
        try {
          // Formato: 2025-08-28T21-30-45-123Z
          if (timestamp.includes('T') && timestamp.includes('Z')) {
            // Substituir hífens por dois pontos nas partes de hora, mas manter ponto nos milissegundos
            const parts = timestamp.split('T');
            const datePart = parts[0]; // 2025-08-28
            let timePart = parts[1].replace('Z', ''); // 21-30-45-123
            
            // Separar a parte dos milissegundos
            const timeComponents = timePart.split('-');
            if (timeComponents.length === 4) {
              // 21-30-45-123 -> 21:30:45.123
              timePart = `${timeComponents[0]}:${timeComponents[1]}:${timeComponents[2]}.${timeComponents[3]}`;
            } else {
              // Fallback: substituir todos os hífens por dois pontos
              timePart = timePart.replace(/-/g, ':');
            }
            
            const isoString = `${datePart}T${timePart}Z`;
            parsedDate = new Date(isoString);
          } else {
            // Fallback para outros formatos
            parsedDate = new Date(timestamp.replace(/-/g, ':'));
          }
        } catch (error) {
          parsedDate = new Date(); // Data atual como fallback
        }
        
        const isValidDate = !isNaN(parsedDate.getTime());
        
        return {
          filename: file,
          timestamp: timestamp,
          date: isValidDate ? parsedDate.toLocaleString('pt-BR', {
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }) : 'Data inválida'
        };
      })
      .sort((a, b) => {
        // Usar o nome do arquivo para ordenação se a data falhar
        return b.filename.localeCompare(a.filename);
      });
    
    res.json({
      success: true,
      data: backupFiles
    });
  } catch (error) {
    console.error('Erro ao listar backups:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// POST /api/admin/restore - Restaurar backup
router.post('/restore', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { filename } = req.body;
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        message: 'Nome do arquivo de backup é obrigatório'
      });
    }
    
    const backupPath = path.join(__dirname, '../backups', filename);
    
    // Verificar se o arquivo existe
    try {
      await fs.access(backupPath);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'Arquivo de backup não encontrado'
      });
    }
    
    // Ler o backup
    const backupData = await fs.readFile(backupPath, 'utf8');
    const backup = JSON.parse(backupData);
    
    // Validar estrutura do backup
    if (!backup.eventos || !backup.noticias) {
      return res.status(400).json({
        success: false,
        message: 'Arquivo de backup inválido'
      });
    }
    
    // Criar backup dos dados atuais antes de restaurar
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const currentEventosData = await fs.readFile(path.join(__dirname, '../data/eventos.json'), 'utf8');
    const currentNoticiasData = await fs.readFile(path.join(__dirname, '../data/noticias.json'), 'utf8');
    
    const currentBackup = {
      timestamp: new Date().toISOString(),
      eventos: JSON.parse(currentEventosData),
      noticias: JSON.parse(currentNoticiasData)
    };
    
    const currentBackupFilename = `backup-before-restore-${timestamp}.json`;
    const currentBackupPath = path.join(__dirname, '../backups', currentBackupFilename);
    await fs.writeFile(currentBackupPath, JSON.stringify(currentBackup, null, 2));
    
    // Restaurar os dados
    await fs.writeFile(
      path.join(__dirname, '../data/eventos.json'), 
      JSON.stringify(backup.eventos, null, 2)
    );
    await fs.writeFile(
      path.join(__dirname, '../data/noticias.json'), 
      JSON.stringify(backup.noticias, null, 2)
    );
    
    res.json({
      success: true,
      message: 'Backup restaurado com sucesso',
      data: {
        restoredFrom: filename,
        backupCreated: currentBackupFilename,
        restoredAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Erro ao restaurar backup:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
