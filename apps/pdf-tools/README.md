# SEPLAN PDF

App estatico para manipular PDFs no navegador:

Versao: `1.0-homologacao`.

- juntar varios PDFs em um unico arquivo;
- compactar PDF com qualidade/resolucao configuravel;
- tentar atingir um tamanho alvo em MB;
- dividir PDF ao meio, a cada N paginas ou por intervalos;
- extrair paginas escolhidas para um novo PDF.
- organizar PDF removendo, reordenando e girando paginas;
- girar paginas;
- adicionar marca d'agua de texto;
- adicionar numeros de pagina;
- converter PDF para JPG;
- converter JPG/PNG para PDF;
- cortar margens;
- inserir assinatura visual;
- adicionar texto ou carimbo simples;
- tarjar area sensivel com PDF final achatado;
- comparar dois PDFs em imagens lado a lado;
- extrair TXT de PDFs pesquisaveis;
- achatar formularios preenchidos;
- limpar ou definir metadados;
- adicionar capa/folha de rosto;
- gerar PDF com 2 ou 4 paginas por folha.

## Como abrir

Para uso local por duplo clique, execute:

```text
ABRIR-APP-SEPLAN-PDF.bat
```

Ou abra diretamente:

```text
seplan-pdf-local.html
```

Evite acessar `127.0.0.1:4173` se nenhum servidor estiver rodando.

Na homologacao, o app avisa acima de 120 MB por operacao e bloqueia preventivamente acima de 250 MB para evitar travamentos em maquinas comuns.

Para testar localmente com Python manualmente, apenas se quiser servir por localhost:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Depois acesse:

```text
http://127.0.0.1:4173
```

## Integracao na Central SEPLAN

Copie a pasta inteira `seplan-pdf-tools` para a area publica do sistema.

As bibliotecas ficam na pasta `vendor` e sao referenciadas em `index.html`, dentro de `window.SEPLAN_PDF_LIBS`:

- `vendor/pdf-lib.min.js`: juntar, dividir e extrair paginas;
- `vendor/pdf.min.js` e `vendor/pdf.worker.min.js`: renderizar paginas para compactacao;
- `vendor/jszip.min.js`: gerar ZIPs com varias partes.

## Observacao sobre compactacao

A compactacao renderiza cada pagina como imagem JPEG e monta um novo PDF. Isso costuma reduzir bastante arquivos escaneados, mas pode transformar texto pesquisavel em imagem. Para preservar melhor a leitura, use qualidade e resolucao mais altas.

## Recursos de fase backend

Para ficar equivalente a suites pagas em arquivos grandes e documentos complexos, os recursos abaixo devem ser feitos com backend interno:

- OCR pesquisavel;
- PDF para Word/Excel/PowerPoint com fidelidade;
- Word/Excel/PowerPoint para PDF;
- assinatura digital avancada;
- protecao/desbloqueio com criptografia forte;
- reparo de PDF corrompido;
- IA para resumo e traducao.
