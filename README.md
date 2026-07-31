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
•	Evoluir as súmulas PDF com cadastros estruturados de atletas, árbitros e lançamentos individuais.
•	Persistir nas súmulas os lançamentos individuais já suportados pelo motor de regras 2025.
•	Filtros e Busca: Adicionar campo de pesquisa rápida nas tabelas de inscritos e partidas.

## 6. Regras funcionais do MVP

As modalidades são definidas exclusivamente em `Modalidades.gs`, com IDs estáveis e regras do Regulamento 2025. `Dominio2025.gs` complementa os limites finais com composição de equipes, apuração da Tava, Carambola da Bocha 48, soma do Tetarfe, quedas do Truco, homologação auditada e Troféu Eficiência.

O chaveamento do MVP sorteia os inscritos confirmados e cria confrontos persistentes da primeira rodada. Com quantidade ímpar, uma equipe recebe passagem automática (`bye`). Uma chave existente não pode ser recriada acidentalmente.

A exclusão de equipe é lógica e cancela suas inscrições. Equipes relacionadas a partidas ativas não podem ser excluídas, preservando o histórico e a integridade referencial. O Troféu Eficiência utiliza apenas classificações homologadas e desempata por primeiros, segundos e terceiros lugares.

## 7. Implantação e testes

Consulte `DEPLOY.md` para preparar os ambientes e publicar o WebApp. Antes de uma nova versão, execute `npm test`; os testes usam simuladores locais das APIs do Google Sheets e cobrem regras, schemas, validação, integridade, chaveamento e ranking.

## 8. Súmulas em PDF

Partidas finalizadas disponibilizam uma súmula preenchida com os dados existentes no SAE. O operador pode baixar um PDF individual ou agrupar todas as partidas finalizadas da modalidade. Os documentos preservam a densidade dos modelos impressos: Truco/Truco Cego, Bocha Campeira e Bocha 48 usam duas fichas por página, Tava usa quatro e Tetarfe usa uma. Assinaturas e dados ainda não cadastrados permanecem em branco para preenchimento físico.

O logotipo oficial da CBTG é resolvido a partir de `https://ibb.co/Y7fDQCY6`, convertido em data URL e armazenado temporariamente no cache do Apps Script. Se o provedor estiver indisponível, o PDF continua sendo gerado com a identificação textual CBTG.

## 9. Domínio regulamentar 2025

O cadastro regulamentar separa torneios, CTGs, atletas, vínculos por evento, equipes e integrantes. CTGs têm regularidade administrada localmente; atletas são identificados por nome e telefone e podem disputar todas as modalidades pelo mesmo CTG. A composição é validada conforme a modalidade e o cadastro simplificado anterior permanece desativado.

O ranking possui dois níveis. Resultados esportivos permanecem nas partidas e classificações de modalidade. Somente classificações homologadas alimentam o Troféu Eficiência pela escala 10, 8, 6, 5, 4 e 2 pontos. WO, ausência, desistência, desclassificação e não conclusão valem zero. O desempate geral considera primeiros, segundos e terceiros lugares, e reaberturas exigem motivo e auditoria.
