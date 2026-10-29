# Volta — sistema de interface

Reformulação solicitada e aplicada em 29/10/2026. Substitui a identidade anterior verde/dourada por uma interface de operação neutra.

## A. Diagnóstico

- Saturação visual na navegação, repetição de mensagens e indicadores e dourados com brilho competiam com a tarefa.
- Gradientes, contornos concêntricos e marca repetida no miolo da roda não ajudavam a escolher, editar ou sortear.
- O CSS tinha sucessivas camadas de sobrescrita, tornando os estilos difíceis de prever.
- A cor era escolhida com módulo de uma lista de oito itens, repetindo a partir da nona opção.

## B. Remoções

- Gradientes da roda, reflexo, órbitas, acabamento dourado e ícone no cubo.
- Slogan da navegação, frase de encerramento e frase promocional do editor.
- Cores decorativas nos ícones de navegação, badges coloridos e bordas com halos.
- Regras CSS antigas e sobrescritas; a folha foi substituída por um sistema único.
- Escolha de cor pelo resto da divisão do número de opções por oito.

## C. Estrutura e regras

Modo: Operate. Uso em navegador, com leitura e edição contínuas; superfícies claras neutras favorecem a leitura e deixam a cor concentrada na roleta.

- Neutros zinc: fundo #fafafa, superfícies #ffffff, texto #27272a, apoio #52525b e divisórias #e4e4e7. Ações primárias #18181b; vermelho para exclusão/erros.
- Escala tipográfica: 11/12 px para metadados, 13/14 px para campos e ações, 16/17 px para subtítulos e 26/28 px para títulos. Peso 400/500 para corpo, 550/600 para hierarquia.
- Espaçamento em múltiplos de 4 px, bordas de 1 px e raios de 6–12 px. Sombras apenas onde há elevação funcional: diálogo, aviso e roda.
- Navegação lateral de 224 px, área principal com cabeçalho, seletor de modo, título e conteúdo. No modo individual, roda e editor lado a lado; no simultâneo, repetição funcional de roletas em grade. Não há Bento Grid de métricas ou cartões decorativos.
- Campos e abas mantêm foco visível, navegação por teclado, controles nativos, painel identificado, gestão de foco do resultado e estado explícito de salvamento. Controles do editor móvel têm áreas de 44 × 44 px.
- A cor representa cada opção, não a estrutura da página. Há 24 cores base e geração determinística adicional. Novas opções e lotes evitam valores já usados; até 500 opções podem receber hexadecimais distintos. Cores próximas podem ser difíceis de distinguir em listas grandes: o texto continua sendo a identificação principal.
- A ação “Renovar cores” aplica a nova sequência a uma roleta existente; cores personalizadas não são substituídas silenciosamente.
- O movimento do ponteiro e os pinos são funcionais e foram preservados, assim como o tamanho das rodas, a duração do giro e as probabilidades iguais.

## Referências

- [Geist: cores](https://vercel.com/geist/colors) e [tipografia](https://vercel.com/geist/typography): hierarquia de superfície, texto e controles.
- [Radix: acessibilidade](https://www.radix-ui.com/primitives/docs/overview/accessibility): semântica, foco e operação por teclado. Foram usados os padrões, sem adicionar uma biblioteca React ao projeto SolidJS.
- [Linear: refinamento da interface](https://linear.app/now/behind-the-latest-design-refresh): hierarquia e redução de ruído.

Nenhuma dependência, fonte externa, imagem remota ou chamada de rede foi adicionada. O resultado é uma interpretação desses padrões, sem alegação de certificação WCAG ou implementação integral de Geist, Radix ou Material Design.
