# Auditoria de produção — 29/10/2026

## Correções realizadas

| Prioridade | Problema                                                                                   | Correção                                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta       | Assets tinham caminho absoluto na raiz, incompatível com a URL do projeto no Pages.        | `BASE_PATH=/spin-weel/` no build de publicação; desenvolvimento continua na raiz. Verificação automática confirma referências e arquivos do artefato.                                                                              |
| Alta       | Não havia pipeline de publicação reproduzível.                                             | Workflow com Node 22, `npm ci`, auditoria de dependências, testes, build e verificação do artefato antes do deploy. Actions oficiais fixadas por SHA, timeout e permissões mínimas por job. PRs só validam; apenas `main` publica. |
| Média      | Atraso de 350 ms no salvamento podia perder a última edição ao fechar ou ocultar a página. | Gravação imediata nos eventos `pagehide` e `visibilitychange`. Erros continuam visíveis e o backup permanece disponível.                                                                                                           |
| Média      | Outra aba podia substituir dados sem aviso.                                                | Conferência otimista do último valor salvo antes de gravar. Se houver diferença, interrompe a gravação e orienta a exportar/recarregar. Não constitui transação atômica entre processos.                                           |
| Média      | `_headers` poderia dar impressão de proteções que o Pages não aplica.                      | Limitação documentada explicitamente. CSP permanece no HTML e `Referrer-Policy` é aplicada por meta. Proteção personalizada contra enquadramento e permissões do navegador não é garantida no Pages.                               |

## Verificações

- Auditoria das dependências: nenhuma vulnerabilidade conhecida reportada na consulta desta revisão.
- TypeScript e compilação de produção, inclusive no subcaminho `/spin-weel/`.
- Testes de sorteio, cores, contraste, validação de backups, segurança e persistência.
- Artefato validado para existência dos assets, política de conteúdo, ausência de source maps, arquivos de ambiente, chaves e links simbólicos.
- Dados de usuário são renderizados como texto ou Canvas; não há uso de `innerHTML`, `eval` ou chamadas externas na aplicação.
- Som é gerado localmente por Web Audio após interação; não depende de arquivo ou serviço externo.

## Limites operacionais

Os dados pertencem à origem do navegador. A versão em localhost e a versão publicada têm armazenamentos diferentes; use exportação/importação para transferir roletas. Perfis diferentes e limpeza do navegador também não preservam esses dados.

GitHub Pages usa uma mesma origem para projetos de uma conta. O armazenamento local não é um cofre de dados sensíveis e o sorteio local não fornece comprovação externa contra manipulação. Não há servidor, autenticação, sincronização ou recuperação remota.

A revisão não equivale a teste de invasão independente nem certificação de acessibilidade. Validação do deploy deve incluir o workflow concluído e abertura da URL publicada.
