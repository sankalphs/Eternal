import { SelfPlayTrainer } from './src/lib/game/rl';

const trainer = new SelfPlayTrainer();
trainer.clearSaved();
trainer.agent.lr = 3e-3;
trainer.agent.entropyCoef = 0.01;

console.log('=== 200 PPO updates, lr=3e-3, no ÷n, clip 0.5 ===');
for (let i = 0; i < 200; i++) {
  while (trainer.agent.bufLen < trainer.agent.minBufferSize) trainer.runEpisode();
  const res = trainer.agent.train();
  trainer.agent.episodes++;
  trainer.agent.entropyCoef = 0.01 * (1 - trainer.agent.episodes/2000) + 0.001 * (trainer.agent.episodes/2000);
  if ((i+1) % 20 === 0) {
    console.log(`Up ${i+1}: vLoss=${res.valueLoss.toFixed(3)} ent=${res.entropy.toFixed(3)} pLoss=${res.policyLoss.toFixed(5)}`);
  }
}

const labels = ["none","left","right","up","down","punch","kick","roundhouse","roll","block"];
const rawState = [0.4, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0.083, 1, 0, 0, 0, 1, 0, 0, 0, -1];
const normState = trainer.agent.obsStats.normalize(rawState);
const probs = trainer.agent.policyForward(normState).probs;
console.log('\nPolicy after 200 updates:');
for (let i = 0; i < probs.length; i++) console.log(`  ${labels[i]}: ${probs[i].toFixed(3)}`);
console.log('Max:', Math.max(...probs).toFixed(3));
let H = 0; for (const p of probs) if (p>1e-8) H -= p*Math.log(p);
console.log('Entropy:', H.toFixed(3), '/ 2.303');
