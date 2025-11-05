import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { bookRoutes } from './routes/book.routes';
import { identity } from './utils/identity';

const app = express();

app.use(helmet());
app.use(express.json());
app.use(identity());

app.use('/api', bookRoutes);

export default app;
