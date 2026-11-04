# Volta

Roletas simples para decidir, sortear e formar equipes. Feito com SolidJS, TypeScript, Tailwind CSS e Vite, sem conta ou servidor. As listas e os históricos são salvos automaticamente neste navegador.

## Executar

```sh
npm install
npm run dev
```

## Validar e gerar produção

```sh
npm test
npm run build
npm run check:dist
npm run preview
```

## Modos

A navegação superior oferece quatro opções que reutilizam as listas salvas:

- **Uma roleta:** todas as opções elegíveis têm a mesma chance.
- **Roletas simultâneas:** até seis roletas com giros individuais ou em conjunto, com chances iguais por opção em cada roleta.
- **Roleta com pesos:** cada opção aceita peso inteiro de 1 a 1.000. O editor mostra as chances e os setores da roda são proporcionais aos pesos. Peso 2 tem o dobro da chance de peso 1. Os pesos ficam guardados na lista, mas só são usados neste modo.
- **Gerar equipes:** escolha a quantidade de equipes ou o máximo de pessoas por equipe. O resultado pode aparecer diretamente ou ser revelado com um giro por participante, incluindo o último. A distribuição é equilibrada, com diferença de no máximo uma pessoa entre equipes. “Parar após este giro” mantém as pessoas já distribuídas e identifica o resultado como incompleto.

Equipes consideram todas as opções ativas, inclusive as já sorteadas na rodada, e ignoram os pesos. Cada participação entra uma única vez. Nomes iguais continuam sendo participações distintas. As equipes não alteram as opções, a rodada nem o histórico de giros. É possível copiar o resultado em texto; ele fica disponível até trocar de modo, de lista ou recarregar.

## Listas e sorteios

- Criar, editar, duplicar e excluir listas, com até 500 opções por lista, 100 listas e 5.000 opções no conjunto.
- Colar uma lista de nomes, buscar sem distinguir caixa ou acentos, ordenar A–Z/Z–A, embaralhar, filtrar duplicados e selecionar várias opções.
- Ativar ou desativar participações sem excluí-las. Nomes duplicados são participações separadas.
- Ajustar cores, renovar a paleta e reorganizar opções. A ordem visual não altera as chances.
- Girar pelo botão central, pelo botão principal ou com Enter fora dos campos e controles.
- Usar “Sem repetição” para retirar vencedores apenas da rodada. Reiniciar restaura as participações da rodada, sem reativar ausentes.
- Sortear vários vencedores em sequência, sem repetir a mesma participação, nos modos de roleta individual e com pesos.
- Copiar resultados e históricos como texto.
- Desfazer exclusões pela barra, pelo aviso ou por Ctrl/Cmd+Z fora dos campos de edição. Até 20 ações ficam disponíveis durante o uso; recarregar ou fechar o aviso limpa essa recuperação.

Não há importação ou exportação de arquivos JSON/CSV nem catálogo de modelos. As roletas já salvas continuam disponíveis. Os dados pertencem ao navegador e à origem onde o site é aberto; limpar os dados do navegador remove as listas e históricos. Não há sincronização entre dispositivos.

## Configurações e apresentação

A **engrenagem** abre duração do giro (4, 9 ou 14 segundos), volume, modo surpresa, compartilhamento, instalação e diagnóstico local.

O ícone de **paleta**, separado da engrenagem, abre a personalização da apresentação: título do evento (80 caracteres), mensagem do resultado (120 caracteres) e fundo neutro, areia, céu ou menta. As preferências ficam neste navegador. O botão de tela cheia entra no modo apresentação, ocultando a navegação e o editor; Escape ou o botão de sair retornam ao modo normal.

Modo surpresa oculta os nomes na roda e revela os resultados. É um efeito visual: editor, histórico e links continuam contendo os nomes.

## Compartilhamento

Links compartilham uma cópia da roleta pelo fragmento do endereço, sem servidor, histórico ou sessões. O link respeita as chances do modo atual: opções com chances iguais em “Uma roleta”, pesos preservados em “Roleta com pesos”. Quem recebe vê uma prévia antes de adicionar. Listas compartilhadas com pesos diferentes de 1 abrem no modo com pesos. Opções desativadas continuam desativadas. O link não é criptografado e tem limite de 8.000 caracteres.

O QR Code usa o mesmo link, gerado localmente, com opção de baixar a imagem PNG ou copiar o endereço. Seu limite é de 1.400 caracteres para manter a leitura. O gerador QR é carregado ao abrir esse controle e preparado para offline após o primeiro uso online.

## Histórico por sessão de sorteio

Na aba Histórico, “Sessões de sorteio” guarda participantes, pesos efetivamente usados, datas e resultados em ordem de sorteio. O primeiro giro inicia uma sessão automaticamente; é possível iniciar outra com nome ou encerrá-la. Alterar os participantes, sua ordem, nomes ou pesos efetivos inicia outra sessão no próximo giro.

O histórico recente de 20 resultados é independente das sessões. Cada roleta mantém até 20 sessões; o conjunto admite até 5.000 resultados e 10.000 participações arquivadas. Os próximos giros são bloqueados ao atingir esses limites. Copie os resultados e exclua sessões antigas para liberar espaço. Sequências reservam espaço para os vencedores solicitados e giros interrompidos não viram resultados. A exclusão de sessões pode ser desfeita durante o uso, respeitando os limites do conjunto.

No modo simultâneo, até 20 combinações de listas podem ser salvas para reutilização.

## Instalação, offline e desempenho

O build gera manifesto, ícones e service worker. A instalação depende do navegador; no Safari, use Compartilhar → Adicionar à Tela de Início. Após o primeiro acesso online e a preparação do cache, o app funciona offline. Módulos opcionais, como QR e diagnóstico, ficam disponíveis offline após o primeiro uso online. A disponibilidade depende de o navegador preservar seu cache.

Atualizações ficam pendentes até “Atualizar aplicativo”; giros e recuperação de dados bloqueiam a atualização. O worker controla apenas o próprio subcaminho e remove somente os caches do Volta nesse escopo.

A seleção usa `crypto.getRandomValues()` com amostragem por rejeição. A roda termina no centro do setor sorteado. O Canvas é redesenhado apenas ao alterar sua aparência; durante o giro, requestAnimationFrame atualiza a rotação e o ponteiro. A duração conta tempo de animação exibida: pausas de aba ou travamentos prolongam o giro. Movimento reduzido suaviza a reação do ponteiro, preservando a animação solicitada.

Listas com mais de 50 opções usam páginas de 50 linhas; busca e seleção abrangem todas as páginas. O diagnóstico opcional guarda até 30 visitas localmente, sem nomes, URLs ou envio externo. Consulte [SECURITY.md](SECURITY.md) e [a auditoria de produção](docs/PRODUCTION-AUDIT.md) para os limites de segurança e hospedagem.

## Publicação no GitHub Pages

O workflow `.github/workflows/pages.yml` valida e publica `main` em <https://danielx77.github.io/spin-weel/>. Em pull requests, executa apenas a validação. Usa Node 22, dependências do lockfile e Actions oficiais fixadas por SHA.

```sh
BASE_PATH=/spin-weel/ npm run build
BASE_PATH=/spin-weel/ npm run check:dist
```

A pasta `dist` pode ser hospedada em qualquer servidor estático com HTTPS. O build gera CSP no HTML e `dist/_headers` para plataformas compatíveis.
