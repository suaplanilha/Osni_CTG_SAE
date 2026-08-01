# Implantação do SAE no Google Apps Script

1. Crie uma Planilha Google exclusiva para o ambiente e abra **Extensões > Apps Script**.
2. Copie os arquivos `.gs`, `Index.html` e `appsscript.json` para o projeto vinculado à planilha (ou sincronize-os com `clasp`).
3. Execute `initDatabase` uma vez e autorize somente os escopos solicitados.
4. Em **Implantar > Nova implantação > Aplicativo da Web**, execute como o proprietário e selecione o público autorizado para o piloto.
5. Guarde a URL `/exec`, faça um cadastro de homologação e valide inscrição, chaveamento, placar e ranking.
6. Para publicar uma correção, crie uma nova versão e atualize a implantação; não teste alterações diretamente na planilha de produção.

## Operação

- Use planilhas diferentes para desenvolvimento, homologação e produção.
- Restrinja editores da planilha, ative histórico de versões e mantenha uma cópia de segurança antes de migrações.
- Execute `initDatabase` após atualizar este MVP; a migração v6 simplifica os cadastros para nome do piquete, Capataz e nomes dos atletas.
- Ao usar `clasp`, mantenha o `.claspignore`: `tests/run-tests.cjs` é um teste Node local e não pode ser enviado ou copiado para o editor do Apps Script.
- Antes de usar **Resetar banco**, faça backup da planilha. A confirmação `RESETAR EVENTO` apaga todos os dados operacionais e preserva apenas o catálogo das modalidades.
- Monitore falhas em **Execuções** no editor do Apps Script.
- Confirme que o projeto possui autorização para conexões externas (`UrlFetchApp`); ela é usada para carregar o logotipo CBTG informado em `SUMULA_CONFIG`.
- Valide o download individual e o lote por modalidade após finalizar partidas de homologação. O PDF é transmitido ao navegador e não é persistido no Drive.
