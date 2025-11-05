import app from './index';
import { seedOnStart } from '../prisma/seed';

const port = process.env.PORT ?? 7000;

function seedInBackground() {
  seedOnStart()
    .then((seeded) => {
      if (seeded) {
        console.log('Database seeding completed');
      }
    })
    .catch((err) => {
      console.error('Database seeding failed', err);
    });
}

const server = app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
  seedInBackground();
});

server.on('error', (err) => {
  console.error('Failed to start server', err);
  process.exitCode = 1;
});
