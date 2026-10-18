const path = require('node:path');
const { copyFile, cp, mkdir, writeFile } = require('node:fs/promises');

const root = path.resolve(__dirname, '..');
const publishDirectory = path.join(root, 'dist');
const redirects = '/api/* https://etemfl-backend.onrender.com/api/:splat 200!\n';
const headers = '/\n  Cache-Control: public, max-age=0, must-revalidate\n';

async function build() {
  await mkdir(publishDirectory, { recursive: true });
  await copyFile(path.join(root, 'index.html'), path.join(publishDirectory, 'index.html'));
  await copyFile(
    path.join(root, 'Logo Nosyre Tech.png'),
    path.join(publishDirectory, 'Logo Nosyre Tech.png')
  );
  await writeFile(path.join(publishDirectory, '_redirects'), redirects);
  await writeFile(path.join(publishDirectory, '_headers'), headers);

  for (const portal of ['usuario', 'gestor']) {
    await cp(path.join(root, portal), path.join(publishDirectory, portal), { recursive: true });
  }

  await copyFile(
    path.join(root, 'gestor', 'index_g.html'),
    path.join(publishDirectory, 'gestor', 'index.html')
  );

  console.log('Publicação Netlify gerada em dist/ com os portais de paciente e gestor.');
}

build().catch(error => {
  console.error('Falha ao preparar os arquivos para a Netlify:', error);
  process.exitCode = 1;
});
