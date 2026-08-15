import path from 'node:path';
import { Worker } from '@temporalio/worker';
import { createFixtureActivities } from './activities';
import { taskQueue } from './shared';

async function main() {
  const artifactRoot = process.env.AKASHIC_ARTIFACT_ROOT ?? path.resolve('.akashic-runtime/artifacts');
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    activities: createFixtureActivities(artifactRoot),
    taskQueue,
  });
  await worker.run();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
