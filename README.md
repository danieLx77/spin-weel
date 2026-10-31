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
- Sorteio animado em Canvas, com giro de 9 segundos, aceleração suave, desaceleração, pinos e ponteiro com efeito de mola. A preferência por movimento reduzido desativa efeitos decorativos, mas mantém o giro solicitado pelo botão e sua duração configurada.
- Modo simultâneo com até 6 roletas, giro individual ou conjunto e resultados independentes.
- Clique ou toque no botão central da roleta para girá-la; também funciona com Enter ou Espaço ao focar o botão. O centro fica desativado durante o giro ou quando não há opções suficientes.
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
- “Sem repetição” retira os vencedores apenas da rodada. “Reiniciar rodada” restaura as participações ativas; as opções e seus dados continuam no editor. A rodada é salva junto com o backup, inclusive quando resta apenas uma opção elegível.
- Exclusões de roletas e opções podem ser desfeitas pelo aviso, pelo botão da barra ou por Ctrl/Cmd+Z fora dos campos de edição. Até 20 exclusões ficam disponíveis durante a sessão; recarregar ou fechar o aviso limpa essa recuperação.

## Configurações, listas e sessões

- Configurações reúne duração do giro (4, 9 ou 14 segundos), volume, compartilhamento e instalação.
- A duração do giro conta o tempo de animação exibida. Pausas da aba ou travamentos prolongam o sorteio em vez de fazê-lo saltar diretamente para o resultado.
- Links compartilham uma cópia de uma roleta pelo fragmento do endereço, sem servidor. Não incluem histórico nem o progresso da rodada. Opções desativadas continuam desativadas na cópia. Há limite de 8.000 caracteres; para listas maiores, use backup. Quem recebe o link vê uma prévia antes de adicionar a roleta. O link não é criptografado.
- O editor permite busca sem distinção de caixa/acentos, filtro de duplicados, seleção múltipla e exclusão em lote com desfazer.
- CSV aceita uma opção por linha, vírgula, ponto e vírgula ou tabulação, aspas escapadas e cabeçalho opcional `nome,cor`. A coluna de cor é opcional e aceita hexadecimal de seis dígitos. Sem cabeçalho, é usada a primeira coluna. Limites: 5 MB, 500 opções por roleta e 100 caracteres por campo.
- Até 20 sessões guardam combinações de até 6 roletas. Sessões também acompanham os backups; referências são reconstruídas ao importar ou recarregar.

## Instalação e offline

O build gera manifesto, ícones e service worker. A instalação depende do navegador: use “Instalar aplicativo” em Configurações ou a opção equivalente do menu do navegador. No Safari, use Compartilhar → Adicionar à Tela de Início.

Depois do primeiro acesso online e da preparação do cache, as roletas abrem e funcionam offline. QR Code e diagnóstico são guardados após o primeiro uso online. Uma atualização fica pendente até a ação “Atualizar aplicativo”; giros e recuperação de dados bloqueiam a atualização. O worker só controla o próprio subcaminho e remove apenas caches do Volta nesse escopo. A disponibilidade offline depende de o navegador preservar seu cache.

## Participações e resultados

- O botão de olho ao lado de cada opção ativa ou desativa sua participação sem excluir os dados. Opções desativadas ficam fora dos giros simples, simultâneos e sequências. O estado acompanha backups e links; reiniciar uma rodada não reativa ausentes.
- “Sortear vários vencedores” define a quantidade e executa um giro por participação, sem repetir IDs naquela sequência. Nomes iguais continuam sendo participações separadas. Com “Sem repetição” ativo, também são respeitados os sorteios anteriores da rodada.
- “Parar após este giro” preserva os resultados concluídos e não inicia o próximo giro. O resumo completo fica disponível até trocar de roleta, começar outra sequência ou recarregar; o histórico continua limitado aos 20 últimos giros.
- Resumos, resultado individual e histórico oferecem cópia e exportação CSV. O CSV inclui roleta, posição na lista exportada, opção e data UTC. O resumo usa ordem de sorteio; o histórico usa a ordem mais recente primeiro. Para preservar mais de 20 vencedores, exporte o resumo antes de sair.

## Ordem, QR Code e surpresa

- Em “Ferramentas da lista”, A–Z e Z–A ordenam por nome em português, com números em ordem natural; “Embaralhar” usa Fisher–Yates com a mesma fonte criptográfica dos sorteios. As ações abrangem a lista inteira, inclusive opções desativadas, e podem ser desfeitas sem perder edições posteriores. A ordem visual não altera as chances.
- O ícone de QR Code fica ao lado das configurações. Gera uma cópia da roleta pelo mesmo link compartilhável, localmente, com opção de baixar PNG ou copiar o endereço. Para manter o código legível, o link tem limite de 1.400 caracteres; listas maiores continuam compartilháveis pelo link normal (até 8.000 caracteres) ou backup.
- “Modo surpresa”, nas configurações, substitui os nomes da roda por `?` e revela cada vencedor no resultado. Funciona em giros simples, sequências e roletas simultâneas; a preferência fica neste navegador. É um efeito visual: editor, histórico, backups e links continuam contendo os nomes.
- O gerador QR é carregado apenas ao abrir o compartilhamento. O arquivo é guardado para uso offline depois de aberto online pela primeira vez. O decodificador QR usado na validação é uma dependência exclusiva de testes.

## Desempenho e diagnóstico local

- Listas com mais de 50 opções usam páginas de 50 linhas. A busca continua abrangendo toda a lista, a seleção de filtradas pode incluir várias páginas e as alterações mantêm os índices corretos. Ao adicionar uma opção, o editor abre a página dela.
- O histórico não provoca redesenho da roda quando os segmentos continuam iguais. A aparência compara IDs, nomes, ordem e cores; alterações visuais e rodadas sem repetição continuam redesenhando quando necessário.
- O pré-cache guarda uma única cópia do HTML, os imports estáticos essenciais, CSS, manifesto e ícone de 192 px. QR, diagnóstico e ícones adicionais usam cache sob demanda. Uma função aberta antes de o worker assumir a página também é preparada para offline após a instalação. Módulos opcionais com o mesmo hash podem ser preservados ao atualizar; conteúdo de outros aplicativos não é removido.
- Em Configurações → Desempenho, o usuário pode ativar o registro local de até 30 visitas e exportar JSON. A biblioteca `web-vitals` é carregada apenas com o registro ativado. FCP, LCP, CLS, TTFB e INP são guardados quando disponíveis, sem nomes de opções, URLs ou envio externo. INP exige interações e os valores locais não são o p75 da audiência.
- Desativar interrompe a gravação; os observadores já carregados são liberados ao sair/recarregar. Nas próximas visitas, o módulo não é carregado. O diagnóstico pode ficar incompleto em abas abertas em segundo plano ou navegadores sem suporte.
