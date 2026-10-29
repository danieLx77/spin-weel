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

## Apresentação, rodadas e desfazer

- O botão de apresentação oculta o editor e a navegação. Usa tela cheia quando disponível; o botão de sair ou Escape retorna ao modo normal. Funciona também com várias roletas.
- “Sem repetição” retira os vencedores apenas da rodada. “Reiniciar rodada” restaura todas as participações; as opções e seus dados continuam no editor. A rodada é salva junto com o backup, inclusive quando resta apenas uma opção elegível.
- Exclusões de roletas e opções podem ser desfeitas pelo aviso, pelo botão da barra ou por Ctrl/Cmd+Z fora dos campos de edição. Até 20 exclusões ficam disponíveis durante a sessão; recarregar ou fechar o aviso limpa essa recuperação.

## Configurações, listas e sessões

- Configurações reúne duração do giro (4, 9 ou 14 segundos), volume, compartilhamento e instalação.
- Links compartilham uma cópia de uma roleta pelo fragmento do endereço, sem servidor. Não incluem histórico nem vencedores já retirados da rodada. Há limite de 8.000 caracteres; para listas maiores, use backup. Quem recebe o link vê uma prévia antes de adicionar a roleta. O link não é criptografado.
- O editor permite busca sem distinção de caixa/acentos, filtro de duplicados, seleção múltipla e exclusão em lote com desfazer.
- CSV aceita uma opção por linha, vírgula, ponto e vírgula ou tabulação, aspas escapadas e cabeçalho opcional `nome,cor`. A coluna de cor é opcional e aceita hexadecimal de seis dígitos. Sem cabeçalho, é usada a primeira coluna. Limites: 5 MB, 500 opções por roleta e 100 caracteres por campo.
- Até 20 sessões guardam combinações de até 6 roletas. Sessões também acompanham os backups; referências são reconstruídas ao importar ou recarregar.

## Instalação e offline

O build gera manifesto, ícones e service worker. A instalação depende do navegador: use “Instalar aplicativo” em Configurações ou a opção equivalente do menu do navegador. No Safari, use Compartilhar → Adicionar à Tela de Início.

Depois do primeiro acesso online e da preparação do cache, a aplicação abre e funciona offline. Uma atualização fica pendente até a ação “Atualizar aplicativo”; giros e recuperação de dados bloqueiam a atualização. O worker só controla o próprio subcaminho e remove apenas caches do Volta nesse escopo. A disponibilidade offline depende de o navegador preservar seu cache.
