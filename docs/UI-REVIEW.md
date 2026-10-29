# Revisão de UI — 29/10/2026

Modo: operação de uma ferramenta. Escopo: refinamento da interface existente, preservando identidade verde, física, roletas grandes e dados locais.

## Problemas encontrados e melhorias aplicadas

1. **Ação principal abaixo da dobra.** O botão de girar ficava depois de toda a roda, fora da primeira tela em janelas baixas. Foi colocado visualmente antes da roda nos modos individual e simultâneo, com largura clara e hierarquia de ação principal.
2. **Contraste e controles pequenos.** Textos auxiliares foram escurecidos, rótulos ampliados e ícones padronizados em SVG. No celular, mover, excluir e escolher cor têm áreas de 44 × 44 px; a reordenação usa uma linha própria para evitar apertar o campo do nome.
3. **Abas incompletas para teclado.** Opções/Histórico agora têm seleção, foco e painel associados. Setas alternam abas, Home/End vão à primeira/última aba; apenas a aba selecionada entra na sequência normal de Tab. O modo e a roleta ativa também expõem sua seleção.
4. **Estado de falha enganoso.** Uma falha ao salvar deixava “Salvando alterações” indefinidamente. Agora há estado persistente de falha, orientação para exportar backup e nova tentativa na próxima alteração. O estado de giro também é refletido na legenda da roda.
5. **Ruído visual.** Foram retiradas chamadas decorativas acima dos títulos, ornamentos periféricos e halos redundantes nos cartões. Seleção de texto, cursor de edição e barras de rolagem seguem a paleta.

## Verificação

- Inspeção visual em 1280 × 800 e 390 × 844.
- Largura do documento sem transbordamento horizontal no celular.
- Navegação real das abas com ArrowRight e Home, com seleção e foco sincronizados.
- Medição no navegador: controles da primeira opção com áreas de 44 × 44 px no celular.
- Compilação e testes de lógica/segurança.

## Limitação das ferramentas

Revisão manual orientada pela skill Impeccable. O carregador de contexto e o detector foram tentados, mas o mecanismo local da skill não está instalado e seu diretório de cache não é gravável. Não foi gerada pontuação ou relatório automatizado da ferramenta. Não há PRODUCT.md; o contexto foi extraído do projeto e de `docs/DESIGN.md`.
