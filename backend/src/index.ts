import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import vkRouter from './api/vk';
import graphRouter from './api/graph';
import authRouter from './api/auth';

const app = express();

// Включаем trust proxy для работы через ngrok/reverse proxy
app.set('trust proxy', 1);

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '50mb' })); // Увеличиваем лимит для больших графов
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false, // В продакшене должно быть true для HTTPS
      httpOnly: true, 
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax', // Важно для работы через ngrok
    },
  }),
);
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
  }) as any,
);

app.get('/health', (_req: express.Request, res: express.Response) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/vk', vkRouter);
app.use('/api/graph', graphRouter);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
