const path = require('node:path');
const { copyFile, cp, mkdir, writeFile } = require('node:fs/promises');

const root = path.resolve(__dirname, '..');
const publishDirectory = path.join(root, 'dist');
const redirects = [
  '/api/* https://etemfl-backend.onrender.com/api/:splat 200!',
  '/gestor /gestor/ 301',
  '/usuario /usuario/ 301'
].join('\n') + '\n';

async function build() {
  await mkdir(publishDirectory, { recursive: true });
  await copyFile(path.join(root, 'index.html'), path.join(publishDirectory, 'index.html'));
  await writeFile(path.join(publishDirectory, '_redirects'), redirects);

  for (const portal of ['usuario', 'gestor']) {
    await cp(path.join(root, portal), path.join(publishDirectory, portal), { recursive: true });
  }

  console.log('Publicação Netlify gerada em dist/ com os portais de paciente e gestor.');
}

build().catch(error => {
  console.error('Falha ao preparar os arquivos para a Netlify:', error);
  process.exitCode = 1;
});
