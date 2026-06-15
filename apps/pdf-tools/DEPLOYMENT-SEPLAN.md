# Implantacao na Central SEPLAN

## Pacote pronto

Copie a pasta `seplan-pdf-tools` inteira para a area publica da Central SEPLAN.

Arquivos principais:

- `index.html`: entrada recomendada para integracao no sistema;
- `styles.css`: visual do app;
- `app.js`: logica das ferramentas PDF;
- `vendor/`: bibliotecas locais, sem dependencia de internet;
- `seplan-pdf-local.html`: versao para teste por duplo clique;
- `ABRIR-APP-SEPLAN-PDF.bat`: atalho local para teste em Windows.

Ferramentas locais incluidas: juntar, compactar, dividir, extrair, organizar, girar, marca d'agua, numerar, PDF para JPG, JPG/PNG para PDF, cortar, assinatura visual, texto/carimbo, tarjar, comparar, extrair TXT, achatar formularios, editar metadados, adicionar capa e gerar 2/4 paginas por folha.

Versao atual: `1.0-homologacao`.

## Rota sugerida

```text
/central-seplan/pdf
```

Ou, se o sistema usar subpastas:

```text
/apps/pdf-tools/index.html
```

## Dependencias

O app roda no navegador e nao envia arquivos para servidor.

Bibliotecas ja empacotadas:

- `vendor/pdf-lib.min.js`
- `vendor/pdf.min.js`
- `vendor/pdf.worker.min.js`
- `vendor/jszip.min.js`

## Observacoes para producao

- Manter a pasta `vendor` junto do `index.html`.
- Evitar alterar nomes dos arquivos sem atualizar `window.SEPLAN_PDF_LIBS`.
- A versao local avisa acima de 120 MB por operacao e bloqueia preventivamente acima de 250 MB.
- Para PDFs muito grandes, avaliar backend interno futuramente.
- Para documentos sigilosos, manter o processamento local e evitar upload externo.
- Testar em Chrome e Edge antes de publicar para todos os usuarios.
- Validar politica de armazenamento: o app atual nao salva documentos no servidor.
- Executar o checklist `CHECKLIST-HOMOLOGACAO.md` antes de publicar.

## Melhorias futuras recomendadas

- Login/permissao conforme padrao da Central SEPLAN.
- Log interno apenas de uso da ferramenta, sem armazenar arquivos.
- Limite visual de tamanho de arquivo para evitar travamento em maquinas fracas.
- Modo de compressao que preserve texto quando houver backend disponivel.
- OCR e conversao Office por API interna.
- Assinatura digital conforme padrao juridico adotado pela prefeitura.
