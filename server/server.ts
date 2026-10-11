import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import status from './api/status.js';
import sendOtp from './api/otp/send.js';
import verifyOtp from './api/otp/verify.js';
import submitStudent from './api/students/submit.js';
import departments from './api/faculty/departments.js';
import login from './api/faculty/login.js';
import students from './api/faculty/students.js';
import update from './api/faculty/update.js';
import deleteStudent from './api/faculty/delete.js';
import exportStudents from './api/faculty/export.js';
import tpo from './api/tpo.js';

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: '5mb' }));
// Exercise the same handlers locally that Vercel deploys.
app.all('/api/status', status);
app.all('/api/otp/send', sendOtp);
app.all('/api/otp/verify', verifyOtp);
app.all('/api/students/submit', submitStudent);
app.all('/api/faculty/departments', departments);
app.all('/api/faculty/login', login);
app.all('/api/faculty/students', students);
app.all('/api/faculty/update', update);
app.all('/api/faculty/delete', deleteStudent);
app.all('/api/faculty/export', exportStudents);
app.all('/api/tpo', tpo);
async function start() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(root, 'dist')));
    app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => console.log('Portal listening on port ' + port));
}
start().catch(error => { console.error(error); process.exit(1); });
