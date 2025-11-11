import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ClusterService } from './modules/pump-fun/service/cluster.service';

async function bootstrap() {
  if (ClusterService.isWorker()) {
    const app = await NestFactory.createApplicationContext(AppModule);
    app.enableShutdownHooks();
    return;
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      trustProxy: true,
      keepAliveTimeout: 65 * 1000,
      connectionTimeout: 0,
    })
  )
  app.enableShutdownHooks();

  await app.listen(3001, '0.0.0.0')
}

ClusterService.clusterize(bootstrap, 10);
