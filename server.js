const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// 确保必要的目录存在
const DATA_DIR = path.join(__dirname, 'data');
const IMAGES_DIR = path.join(__dirname, 'images', 'rocks');
const SPECTRA_DIR = path.join(__dirname, 'spectra');
const PUBLIC_DIR = path.join(__dirname, 'public');

fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(IMAGES_DIR);
fs.ensureDirSync(SPECTRA_DIR);
fs.ensureDirSync(PUBLIC_DIR);

// 岩石数据文件路径
const ROCKS_FILE = path.join(DATA_DIR, 'rocks.json');

// 初始化岩石数据文件
if (!fs.existsSync(ROCKS_FILE)) {
  const initialRocks = require('./data/rocks.json');
  fs.writeJsonSync(ROCKS_FILE, initialRocks, { spaces: 2 });
}

// 中间件配置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
//app.use(session({
//  secret: 'rock-spectrum-secret-key',
//  resave: false,
//  saveUninitialized: false,
//  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24小时
//}));

app.use(session({
  secret: 'rock-spectrum-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // 生产环境需要 HTTPS
    maxAge: 24 * 60 * 60 * 1000 
  }
}));

// 静态文件服务
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/spectra', express.static(SPECTRA_DIR));
app.use('/', express.static(PUBLIC_DIR));

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'image') {
      cb(null, IMAGES_DIR);
    } else if (file.fieldname === 'spectrum') {
      cb(null, SPECTRA_DIR);
    } else {
      cb(null, '/tmp');
    }
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const uniqueName = `${basename}_${timestamp}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB限制
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'image') {
      const allowedTypes = /jpeg|jpg|png|gif/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      if (mimetype && extname) return cb(null, true);
      cb(new Error('只支持图片格式: jpeg, jpg, png, gif'));
    } else if (file.fieldname === 'spectrum') {
      const allowedTypes = /csv/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      if (extname) return cb(null, true);
      cb(new Error('只支持CSV格式的光谱文件'));
    } else {
      cb(null, true);
    }
  }
});

// 辅助函数：读取岩石数据
function getRocks() {
  try {
    return fs.readJsonSync(ROCKS_FILE);
  } catch (err) {
    return [];
  }
}

// 辅助函数：保存岩石数据
function saveRocks(rocks) {
  fs.writeJsonSync(ROCKS_FILE, rocks, { spaces: 2 });
}

// 辅助函数：生成新ID
function generateNewId(rocks) {
  const maxId = rocks.reduce((max, rock) => {
    const num = parseInt(rock.id.replace(/\D/g, '')) || 0;
    return Math.max(max, num);
  }, 0);
  return `SAMPLE${String(maxId + 1).padStart(3, '0')}`;
}

// ==================== 权限中间件 ====================
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: '需要管理员权限' });
  }
}

function isAuthenticated(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ error: '请先登录' });
  }
}

// ==================== 认证API ====================
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  // 简单硬编码管理员账号，实际生产应使用加密
  if (username === 'admin' && password === 'admin123') {
    req.session.user = { username, role: 'admin' };
    res.json({ success: true, user: { username, role: 'admin' } });
  } else if (username === 'guest' && password === 'guest') {
    req.session.user = { username, role: 'guest' };
    res.json({ success: true, user: { username, role: 'guest' } });
  } else {
    res.status(401).json({ success: false, error: '用户名或密码错误' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/check-auth', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});

// ==================== 岩石数据API ====================
// 获取所有岩石数据（游客和管理员均可）
app.get('/api/rocks', (req, res) => {
  const rocks = getRocks();
  res.json(rocks);
});

// 获取单个岩石详情
app.get('/api/rocks/:id', (req, res) => {
  const rocks = getRocks();
  const rock = rocks.find(r => r.id === req.params.id);
  if (rock) {
    res.json(rock);
  } else {
    res.status(404).json({ error: '样本不存在' });
  }
});

// 创建新岩石样本（管理员）
app.post('/api/rocks', isAdmin, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'spectrum', maxCount: 1 }]), (req, res) => {
  try {
    const rocks = getRocks();
    const newRock = JSON.parse(req.body.data);
    
    // 处理上传的文件
    if (req.files['image']) {
      newRock.image = req.files['image'][0].filename;
    } else {
      return res.status(400).json({ error: '必须上传岩石图片' });
    }
    
    if (req.files['spectrum']) {
      newRock.spectrum = req.files['spectrum'][0].filename;
    } else {
      return res.status(400).json({ error: '必须上传光谱CSV文件' });
    }
    
    // 生成新ID
    newRock.id = generateNewId(rocks);
    newRock.sample_id = newRock.id;
    
    rocks.push(newRock);
    saveRocks(rocks);
    
    res.json({ success: true, rock: newRock });
  } catch (err) {
    console.error('创建样本失败:', err);
    res.status(500).json({ error: '创建样本失败' });
  }
});

// 更新岩石样本（管理员）
app.put('/api/rocks/:id', isAdmin, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'spectrum', maxCount: 1 }]), (req, res) => {
  try {
    const rocks = getRocks();
    const index = rocks.findIndex(r => r.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: '样本不存在' });
    }
    
    const updatedRock = JSON.parse(req.body.data);
    const oldRock = rocks[index];
    
    // 处理图片更新
    if (req.files['image']) {
      // 删除旧图片
      if (oldRock.image) {
        const oldImagePath = path.join(IMAGES_DIR, oldRock.image);
        if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
      }
      updatedRock.image = req.files['image'][0].filename;
    } else {
      updatedRock.image = oldRock.image;
    }
    
    // 处理光谱更新
    if (req.files['spectrum']) {
      if (oldRock.spectrum) {
        const oldSpectrumPath = path.join(SPECTRA_DIR, oldRock.spectrum);
        if (fs.existsSync(oldSpectrumPath)) fs.unlinkSync(oldSpectrumPath);
      }
      updatedRock.spectrum = req.files['spectrum'][0].filename;
    } else {
      updatedRock.spectrum = oldRock.spectrum;
    }
    
    updatedRock.id = oldRock.id;
    updatedRock.sample_id = oldRock.id;
    
    rocks[index] = updatedRock;
    saveRocks(rocks);
    
    res.json({ success: true, rock: updatedRock });
  } catch (err) {
    console.error('更新样本失败:', err);
    res.status(500).json({ error: '更新样本失败' });
  }
});

// 删除岩石样本（管理员）
app.delete('/api/rocks/:id', isAdmin, (req, res) => {
  try {
    const rocks = getRocks();
    const index = rocks.findIndex(r => r.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: '样本不存在' });
    }
    
    const rock = rocks[index];
    
    // 删除关联的图片和光谱文件
    if (rock.image) {
      const imagePath = path.join(IMAGES_DIR, rock.image);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }
    if (rock.spectrum) {
      const spectrumPath = path.join(SPECTRA_DIR, rock.spectrum);
      if (fs.existsSync(spectrumPath)) fs.unlinkSync(spectrumPath);
    }
    
    rocks.splice(index, 1);
    saveRocks(rocks);
    
    res.json({ success: true });
  } catch (err) {
    console.error('删除样本失败:', err);
    res.status(500).json({ error: '删除样本失败' });
  }
});

// 替换原来的 app.listen(PORT, ...)
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
});

// 启动服务器
//app.listen(PORT, () => {
//  console.log(`服务器运行在 http://localhost:${PORT}`);
//  console.log('管理员账号: admin / admin123');
//  console.log('游客账号: guest / guest');
//});
