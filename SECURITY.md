# Revisão de segurança — Volta

Data: 29/10/2026. Escopo: código local, importação/exportação, armazenamento, renderização, configuração de desenvolvimento/produção e dependências. Esta revisão não é um teste de invasão da infraestrutura de hospedagem.

## Achados e correções

| Achado                                                                                                                     | Impacto                                                                                                                         | Correção                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A importação percorria históricos inteiros antes de reduzi-los; strings e o conjunto total não tinham limites suficientes. | Disponibilidade: um arquivo excessivo podia consumir memória e bloquear a interface.                                            | Backup de até 5 MB, 100 roletas, 500 campos por roleta, 5.000 campos no conjunto e 20 resultados por histórico. Nomes até 80 e campos até 100 caracteres. Os limites estruturais são checados antes de gerar IDs/copiar dados e também se aplicam às alterações no editor. |
| Dados locais inválidos eram substituídos automaticamente por exemplos.                                                     | Integridade: perda dos dados antigos sem oportunidade de recuperação.                                                           | Falha de leitura pausa o salvamento. Uma faixa persistente permite baixar os dados antigos e exige confirmação para substituí-los. A mesma validação de versão e estrutura é usada em arquivos e no armazenamento.                                                         |
| Não havia política de conteúdo e cabeçalhos de proteção na produção.                                                       | Ausência de camadas adicionais de defesa contra injeção e enquadramento. Não foi encontrada injeção executável no código atual. | CSP na página de produção, scripts e recursos restritos à própria origem, bloqueio de objetos e formulários. Prévia de produção com cabeçalhos de proteção; arquivo `dist/_headers` gerado para hospedagens compatíveis.                                                   |
| A prévia era aberta em todas as interfaces de rede.                                                                        | Exposição desnecessária do servidor de desenvolvimento à rede local.                                                            | Desenvolvimento e prévia limitados a `127.0.0.1`; acesso de arquivos sensíveis explicitamente negado pelo servidor de desenvolvimento.                                                                                                                                     |
| Datas e identificadores importados não tinham tratamento uniforme.                                                         | Dados inconsistentes e identificadores controlados pelo arquivo.                                                                | Datas inválidas são descartadas, datas válidas normalizadas, IDs sempre gerados localmente e propriedades extras não são copiadas. Cores aceitam somente hexadecimal de seis dígitos.                                                                                      |

## Verificações

- `npm audit --json`: nenhuma vulnerabilidade conhecida reportada na consulta realizada em 29/10/2026. Isso não garante ausência de falhas desconhecidas.
- Testes de regressão: envelopes inválidos, excesso de tamanho, orçamento total, histórico excessivo, datas inválidas, propriedades `__proto__`, cores maliciosas e política de produção.
- Renderização: nomes e resultados são tratados como texto por SolidJS ou desenhados no Canvas. Não há `innerHTML`, `eval` ou execução de conteúdo importado.
- Não há autenticação, cookies, credenciais, chamadas externas no código da aplicação ou servidor de dados. O sorteio continua usando Web Crypto com amostragem por rejeição.
- A versão de produção é compilada e conferida no navegador com sua política de conteúdo ativa.

## Limites e publicação

Os dados ficam em texto no navegador; pessoas ou extensões com acesso a esse perfil podem acessá-los ou alterá-los. Um aplicativo inteiramente local não fornece comprovação externa contra manipulação de resultados.

A política em meta funciona no HTML de produção, mas a proteção contra enquadramento depende de cabeçalhos HTTP. O arquivo `_headers` precisa ser aplicado por uma hospedagem compatível; em outros servidores, configure os cabeçalhos equivalentes e HTTPS. A configuração da hospedagem final não foi auditada.

A CSP de produção não é aplicada ao servidor de desenvolvimento: o recarregamento e as ferramentas do Vite têm necessidades diferentes. Não use o servidor de desenvolvimento para hospedar a versão pública.

Referências: [CSP no Vite](https://vite.dev/guide/features#content-security-policy-csp), [limitação de frame-ancestors em meta, MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).

## GitHub Pages

A hospedagem em `https://danielx77.github.io/spin-weel/` aplica a CSP presente no HTML e a política de referência por meta. GitHub Pages não interpreta `dist/_headers`: não se deve considerar `frame-ancestors`, `X-Frame-Options` ou `Permissions-Policy` personalizados como ativos nessa plataforma. Não há contas, credenciais ou ações financeiras no aplicativo. Se proteção por cabeçalhos próprios for requisito futuro, será necessária uma hospedagem que os suporte.

As dependências são instaladas pelo lockfile; Actions oficiais ficam fixadas por SHA. A publicação só ocorre após testes, verificação de vulnerabilidades graves e validação dos assets. Permissões de publicação e OIDC ficam restritas ao job de deploy, que depende do build e só executa na `main`.

## Compartilhamento e cache offline

Links são limitados a 8.000 caracteres, validados antes de exibir a prévia e importados apenas após ação do usuário. O fragmento contém a configuração em texto codificado, sem criptografia: não deve carregar informações sigilosas. Não há encurtador, banco de dados ou upload de opções.

CSV é tratado como dados de texto; células não são executadas e cores aceitam somente hexadecimal. Sessões e preferências têm limites próprios. O cache offline contém exclusivamente arquivos estáticos do aplicativo, não backups ou dados do usuário; o service worker se restringe à própria origem e ao subcaminho de publicação. Atualizações não recarregam a página automaticamente durante uma tarefa.

## Exportação de resultados

O CSV de resultados escapa aspas, vírgulas e quebras de linha, e prefixa conteúdo que possa ser interpretado como fórmula por planilhas. A geração e o download acontecem localmente. A sequência registra apenas animações concluídas e respeita opções desativadas e os limites da rodada.
