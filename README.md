Aqui está a Documentação Técnica e Funcional Completa do MVP desenvolvido até o momento. Ela reflete exatamente a arquitetura, o estado atual do código e o roadmap de evolução para apresentação e controle do projeto.
________________________________________
📄 Documentação Técnica do Projeto: Sistema de Torneios Campeiros (SAE ERP)
Versão: 1.0 (MVP)
Padrão de Arquitetura: SAE (Sistema Apollo Enterprise)
Status Atual: MVP funcional para homologação
________________________________________
1. Visão Geral do Projeto
1.1 Objetivo
Automatizar a gestão e apuração de resultados de torneios de esportes campeiros gaúchos, substituindo o processo manual de preenchimento de súmulas impressas por uma aplicação web rápida, moderna e centralizada.
1.2 Escopo de Esportes Suportados (6 Modalidades)
1.	Tava
2.	Bocha Campeira
3.	Tetarfe
4.	Truco
5.	Truco Cego
6.	Bocha 48
________________________________________
2. Arquitetura da Solução
[ Frontend: Vue 3 Single-File (Index.html) ]
                   │
                   ▼ (google.script.run / Async Wrappers)
[ Controller API: Endpoints em GAS (Código.gs) ]
                   │
                   ▼ (LockService / Normalização)
[ Persistência & CRUD: Engine (Database.gs) ]
                   │
                   ▼
[ Banco de Dados: Google Sheets (ctg_db) ]
2.1 Stack Tecnológica Mandatória
•	Frontend: Vue 3 (CDN), HTML5 Single-File, Tailwind CSS (CDN), Google Material Symbols e PWA progressiva.
•	UI/UX: Glassmorphism Dark UI (Padrão SAE), Mobile-First, Skeleton/Loader tipo Google.
•	Backend: Google Apps Script (GAS) em Runtime V8 (`codigo.gs`, `Database.gs`, `SetupDB.gs` e `Modalidades.gs`).
•	Banco de Dados: Google Sheets (1 Aba = 1 Entidade, UUIDs v4, Datas ISO 8601).
________________________________________
3. Modelo de Dados (Google Sheets - ctg_db)
O banco de dados relacional foi estruturado nas seguintes 5 tabelas (abas):
Nome da Aba	Função / Entidade	Campos / Colunas
tb_equipes	Cadastro de Competidores	id_equipe, nome_equipe, ctg_responsavel, contato, data_criacao, ativo
tb_modalidades	Catálogo dos 6 Esportes	id_modalidade, nome_modalidade, regras_pontos, ativo
tb_inscricoes	Vínculo Equipe-Esporte	id_inscricao, id_equipe, id_modalidade, status, data_inscricao
tb_partidas	Confrontos e Súmulas	id_partida, id_modalidade, rodada, chave, id_equipe_a, placar_a, id_equipe_b, placar_b, status_partida, data_atualizacao
tb_pontuacao_geral	Ranking Unificado	id_registro, ctg, pontos_totais, vitorias_totais, ultima_atualizacao
________________________________________
4. Estrutura do Código e Módulos Criados
4.1 Backend
1.	SetupDB.js:
o	Script de inicialização automática de tabelas (initDatabase).
o	Povoamento automático das 6 modalidades (seed).
o	Utilitários para geração de UUID v4 e datas ISO.
2.	Database.js:
o	Motor de persistência genérico (dbRead, dbInsert, dbUpdate).
o	Tratamento de concorrência via LockService para prevenir perda de dados em acessos simultâneos.
3.	Código.gs:
o	doGet(): Entrega a interface webApp.
o	Endpoints API: apiGetEquipes, apiCadastrarInscrito, apiGetPartidasPorModalidade, apiSalvarResultadoPartida e apiGetClassificacaoGeral.
o	Job Automático: processarPontuacaoGeral que recalcula o ranking do Campeão Geral ao final de cada partida.
4.2 Frontend (Index.html)
•	Navegação em Abas:
1.	Inscrições e Chaves: Formulário dinâmico de cadastro de participantes e visualização da lista.
2.	Confrontos / Súmulas: Seletor por modalidade e cartões de lançamento de placar ao vivo.
3.	Campeão Geral: Tabela ranqueada em tempo real por pontuação acumulada e número de vitórias por CTG.
•	Camada de Integração: Wrapper genérico baseado em Promise (apiCall) para abstrair chamadas do google.script.run.
________________________________________
5. Status de Desenvolvimento (O que foi / Não foi feito)
✅ Concluído (Entregue no MVP)
•	Setup e modelagem do banco de dados relacional no Google Sheets.
•	Interface completa responsiva em Glassmorphism Dark (Padrão SAE).
•	Endpoints de CRUD e comunicação assíncrona backend-frontend operacionais.
•	Suporte nativo às 6 modalidades esportivas campeiras.
•	Cadastro de equipes com associação de CTG.
•	Lançamento de placares com recálculo automático do Campeão Geral.
⏳ Pendente / Próximas Etapas (Roadmap)
•	Evoluir o chaveamento eliminatório inicial para múltiplas rodadas e formatos por grupos.
•	Impressão de Súmulas/Exportação em PDF: Função para gerar relatório/súmula em PDF caso a organização do torneio necessite de cópia física.
•	Validações específicas por esporte: Aplicar regras particulares de placar máximo para cada modalidade (ex: limite de pontos na Bocha 48 ou regras de vazas no Truco).
•	Filtros e Busca: Adicionar campo de pesquisa rápida nas tabelas de inscritos e partidas.

## 6. Regras funcionais do MVP

As modalidades são definidas exclusivamente em `Modalidades.gs`, com IDs estáveis, limites de placar e política de empate. Tava aceita 0–12, Bocha Campeira 0–12 sem empate, Tetarfe 0–20, Truco e Truco Cego 0–2 sem empate e Bocha 48 aceita 0–48. O backend sempre valida essas regras antes de finalizar uma partida.

O chaveamento do MVP sorteia os inscritos confirmados e cria confrontos persistentes da primeira rodada. Com quantidade ímpar, uma equipe recebe passagem automática (`bye`). Uma chave existente não pode ser recriada acidentalmente.

A exclusão de equipe é lógica e cancela suas inscrições. Equipes relacionadas a partidas ativas não podem ser excluídas, preservando o histórico e a integridade referencial. O ranking soma os placares por CTG e usa vitórias e nome do CTG como critérios de desempate.

## 7. Implantação e testes

Consulte `DEPLOY.md` para preparar os ambientes e publicar o WebApp. Antes de uma nova versão, execute `npm test`; os testes usam simuladores locais das APIs do Google Sheets e cobrem regras, schemas, validação, integridade, chaveamento e ranking.

## 8. Regras
Aqui está a especificação completa e unificada de Regras, Validações e Conceitos de Negócio extraídos do Regulamento de Esportes Campeiros 2025 para o projeto SAE (Sistema Apollo Enterprise).
________________________________________
📜 Especificação de Regras de Negócio e Requisitos de Domínio
Projeto: Sistema de Torneios Campeiros (SAE ERP)
Documento: Consolidação das Regras Oficiais (Regulamento 2025)
Objetivo: Orientar a lógica de validação, limites de cadastro e apuração do sistema sem dependência de implementações de código.
________________________________________
1. Regras de Filiação e Inscrição Geral
•	Vínculo Institucional: Todos os participantes e equipes devem estar vinculados a uma Entidade Tradicionalista (CTG) devidamente regularizada junto ao Movimento Tradicionalista Gaúcho (MTG/RS).
•	Restrição de Representação: Um atleta/competidor só pode pontuar e competir em nome de uma única entidade por torneio.
________________________________________
2. Parâmetros de Composição de Equipes por Modalidade
O sistema de cadastro de inscrições deve validar e travar o número de integrantes por equipe de acordo com os limites de cada modalidade:
Modalidade Esportiva	Formato de Disputa	Mínimo de Atletas	Máximo de Atletas	Regras de Formação da Equipe
Tava	Equipe	3	4	Titulares com opção de descarte do pior resultado individual.
Bocha Campeira	Trio / Quarteto	3	4	Equipe atuante na cancha com limite de substituições.
Tetarfe	Individual / Equipe	1	4	Participação individual acumulando pontos para o CTG.
Truco	Trio	3	4	3 titulares ativos e no máximo 1 reserva cadastrado.
Truco Cego	Trio	3	4	3 titulares ativos e no máximo 1 reserva cadastrado.
Bocha 48	Dupla ou Trio	2	3	Formação em dupla ou trio cadastrado por ficha.
________________________________________
3. Diretrizes e Limites de Pontuação por Partida
Para o lançamento de súmulas e placares, o sistema deve validar os seguintes critérios e restrições:
3.1 Tava
•	Pontuação Base: Somatória dos pontos individuais dos 3 melhores lançadores do trio/equipe (descartando-se a pontuação do 4º integrante, se houver).
•	Valores das Jogadas:
o	Sorte Clavada: +2 pontos.
o	Sorte Corrida: +1 ponto.
o	Culo Clavado: -2 pontos (desconto/penalidade).
o	Culo Corrido: -1 ponto (desconto/penalidade).
•	Validade do Arremesso: A Sorte só é pontuada se a Tava tocar o solo e permanecer dentro dos limites do picador. O Culo é penalizado sempre, independente de onde a Tava tocar.
•	Critérios de Desempate (Conforme Art. 12):
1.	Maior quantidade de Sorte Clavada.
2.	Maior quantidade de Sorte Corrida.
3.	Menor quantidade de Culo Clavado.
4.	Menor quantidade de Culo Corrido.
5.	Rodada extra na cancha com 10 tiros de Tava por jogador (5 em cada cabeceira da cancha).
3.2 Bocha Campeira
•	Pontuação Máxima: Partidas disputadas até 12 pontos (set único).
•	Empate: Não é permitido empate. Havendo igualdade ao término das jogadas regulamentares, disputa-se uma partida/caixa extra de desempate.
3.3 Bocha 48
•	Pontuação Máxima: Teto rígido de 48 pontos por partida/dupla.
•	Empate: Em caso de igualdade de pontuação ao final dos arremessos regulamentares, aplica-se rodada extra de desempate (carambola).
3.4 Tetarfe
•	Mecânica: Soma cumulativa de pontos com base nos acertos nos alvos/argolas definidos na regulamentação.
•	Empate: Havendo empate nas posições de liderança, cada atleta realiza uma série extra de 3 arremessos.
3.5 Truco e Truco Cego
•	Pontuação da Partida: Disputada em rodadas (quedas) de até 12 pontos.
•	Evolução do Mão/Tento: Incrementos de 1, 3, 6, 9 e 12 pontos conforme os pedidos de Truco e reenvios.
•	Empate: Não existe empate em partidas de Truco (sempre há uma equipe vencedora na queda).
________________________________________
4. Conceito da Dupla Estrutura de Ranking
O sistema gerencia o evento utilizando dois níveis independentes de pontuação:
Level 1: Pontuação da Modalidade (Nível Competição Interna)
•	Apuração do resultado direto dos jogos para definir a classificação ordinal dentro do esporte (1º Lugar, 2º Lugar, 3º Lugar, etc.).
•	Utiliza as regras específicas de cada esporte (saldo de pontos, vitórias, partidas ganhas e critérios de desempate técnicos).
Level 2: Pontuação do Ranking Geral (Troféu Eficiência)
•	Apuração unificada do desempenho da entidade tradicionalista (CTG) no evento global.
•	Ao encerramento de cada modalidade, a classificação final da equipe/atleta gera pontos para a tabela do Campeão Geral:
Colocação Final na Modalidade	Pontuação Atribuída ao CTG
1º Lugar (Campeão)	10 Pontos
2º Lugar (Vice-Campeão)	8 Pontos
3º Lugar	6 Pontos
4º Lugar	5 Pontos
5º Lugar	4 Pontos
6º Lugar em diante	2 Pontos (Pontuação de participação concluída)
Critérios de Desempate do Troféu Eficiência (Ranking Geral):
1.	Maior número de 1ºs Lugares acumulados na competição.
2.	Maior número de 2ºs Lugares acumulados na competição.
3.	Maior número de 3ºs Lugares acumulados na competição.
4.	Análise pela Comissão Organizadora / Sorteio oficial.

