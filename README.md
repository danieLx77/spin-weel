# Volta

Gerenciador de roletas em SolidJS, TypeScript, Tailwind CSS e Vite. Sem conta ou servidor: as roletas ficam no armazenamento local do navegador.

## Executar

```sh
npm install
npm run dev
```

## Validar e gerar produção

```sh
npm test
npm run build
npm run preview
```

A pasta `dist` pode ser hospedada em qualquer servidor estático com HTTPS. `crypto.getRandomValues()` escolhe o campo usando amostragem por rejeição, sem viés de módulo. Cada campo tem probabilidade `1/n`; nomes duplicados contam como participações distintas. A animação termina no centro do campo previamente sorteado. O Canvas é desenhado apenas quando as opções mudam; durante o giro, requestAnimationFrame atualiza somente a rotação e a inclinação do ponteiro, sem renderizações reativas por quadro.

## Recursos

- Criar, editar, duplicar e excluir roletas.
- Personalizar, reordenar e adicionar opções em lote (até 500 por roleta).
- Sorteio animado em Canvas, com giro de 9 segundos, aceleração suave, desaceleração, pinos e ponteiro com efeito de mola. Respeita movimento reduzido.
- Modo simultâneo com até 6 roletas, giro individual ou conjunto e resultados independentes.
- Histórico de até 20 resultados por roleta e remoção opcional do vencedor.
- Salvamento automático, importação e exportação de backups JSON.
- Interface responsiva e controles por teclado.

Os dados pertencem ao navegador e à origem onde o site é aberto. Limpar os dados do navegador remove as roletas; exporte backups para transferi-las ou preservá-las. Não há sincronização entre dispositivos. Backups importados são adicionados às roletas existentes.

## Segurança

Consulte [SECURITY.md](SECURITY.md) para a revisão, limites de importação e requisitos de hospedagem. A compilação gera uma CSP no HTML e `dist/_headers` para plataformas compatíveis. A aplicação limita o conjunto a 5.000 opções; backups têm limite de 5 MB. Dados inválidos no armazenamento não são sobrescritos automaticamente.

## Publicação no GitHub Pages

O workflow `.github/workflows/pages.yml` testa e publica a branch `main` em <https://danielx77.github.io/spin-weel/>. Em pull requests, executa somente a validação. O ambiente usa Node 22, dependências do lockfile e Actions oficiais fixadas por SHA.

Para reproduzir o build do Pages:

```sh
BASE_PATH=/spin-weel/ npm run build
BASE_PATH=/spin-weel/ npm run check:dist
```

Consulte [a auditoria de produção](docs/PRODUCTION-AUDIT.md) para as verificações e limitações do GitHub Pages. Roletas salvas no localhost precisam ser exportadas e importadas na versão pública.
