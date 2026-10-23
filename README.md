# Quiz GAV — quiz ao vivo com QR code

Quiz interativo com a identidade da GAV Hotéis e Resorts:

- **Tela do apresentador** (`host.html`), projetada no telão: editor de perguntas, QR code, pergunta, cronômetro (opcional), gráfico de respostas, rankings e pódio.
- **Editor de quizzes**: o palestrante cria e salva quantos quizzes quiser (um por tema ou evento), direto na tela do apresentador, e escolhe se haverá tempo de resposta.
- **Tela do participante** (`index.html`), no celular: a pessoa lê o QR code, **escolhe a sala**, digita o **nome completo** e toca na alternativa. **Cada pessoa vê só a própria resposta e o próprio resultado.**
- **Planilha Google** como memória: todas as respostas, nomes completos, salas, tempos e pontos ficam gravados.
- **Rankings**: o **individual** ordena por número de acertos (no empate, ganha quem respondeu mais rápido). O **das salas** ordena pelo total de respostas certas da sala. O palestrante mostra os dois juntos ou cada um separado.
- **Painel privado** (`host.html?painel=1`): o apresentador vê, no notebook ou no celular dele, a escolha de cada pessoa em tempo real, sem mostrar isso no telão.

Animações tiradas do manual de marca: revelação do logotipo com a ligatura G–A (p. 19), a rosa dos ventos se abrindo como um leque (p. 20) e os grafismos de ondas. A **Brisa**, uma gotinha de onda, é a mascote e aparece na tela do celular. Ela é uma personagem separada, porque o manual proíbe adicionar elementos ao logo e ao símbolo.

---

## 1. Testar agora (sem configurar nada)

Com `API_URL` vazio em `config.js`, o quiz roda em **modo demonstração**, com tudo dentro do mesmo navegador:

1. Abra `host.html` (senha: `demo`) e clique em **Abrir novo quiz**.
2. No editor, escolha o quiz "Marca GAV" ou crie um novo, defina o tempo e clique em **Iniciar quiz**.
3. Clique em **+ Celular de teste** algumas vezes. Cada janela que abrir é um participante.
4. Clique em **Começar** e responda nas janelas.

> Para abrir os arquivos direto do computador, use um servidor local (`python3 -m http.server`) ou publique no GitHub Pages.

## 2. Criar a planilha (backend)

1. Crie uma planilha no Google Sheets, por exemplo **"Quiz GAV"**.
2. Vá em **Extensões → Apps Script**, apague o conteúdo e cole o arquivo `apps-script/Code.gs` inteiro.
3. Na linha `var ADMIN_KEY = 'gav2026';`, **troque a senha**. Ela é a senha do apresentador.
4. Escolha a função **`setup`** no menu e clique em **Executar**. Autorize o acesso. Ela cria as abas `Quizzes`, `Respostas` e `Jogadores`, com um quiz de exemplo ("Marca GAV").
5. Clique em **Implantar → Nova implantação → Tipo: App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Copie a URL que termina em **`/exec`**.

> Se você alterar o `Code.gs` depois, vá em **Implantar → Gerenciar implantações → Editar → Nova versão**, ou as mudanças não entram no ar.

## 3. Publicar no GitHub Pages

1. Suba esta pasta para um repositório (ex.: `gav-quiz`).
2. Em `config.js`, cole a URL `/exec` em `API_URL`.
3. Em **Settings → Pages**, escolha *Deploy from a branch* → `main` / `root`.
4. Endereços:
   - Participantes: `https://SEU-USUARIO.github.io/gav-quiz/` (o QR code aponta para cá)
   - Apresentador: `https://SEU-USUARIO.github.io/gav-quiz/host.html`
   - Painel privado: `https://SEU-USUARIO.github.io/gav-quiz/host.html?painel=1`

> A senha **não** fica no GitHub, só no Apps Script. O `Code.gs` deste repositório vem com a senha de exemplo; troque-a no editor do Apps Script.

## 4. Editar as salas

A lista de salas fica em `config.js`, no item `ROOMS`. Para incluir, remover ou renomear uma sala, edite essa lista no GitHub; as salas aparecem no celular na mesma ordem. O nome completo precisa ter pelo menos nome e sobrenome.

## 5. Criar e editar quizzes

Tudo é feito em `host.html`: depois da senha, abre o **editor**.

- **Quizzes salvos**, à esquerda: clique para abrir um quiz ou em **+ Novo quiz** para criar.
- **Perguntas**, no centro: escreva o enunciado e de 2 a 4 alternativas, depois **clique na letra** da alternativa correta (ela fica verde). As setas mudam a ordem, ⧉ duplica e ✕ remove.
- **Colar várias de uma planilha**: copie as linhas do Excel ou do Sheets nas colunas *Pergunta, A, B, C, D, Correta* e cole. Também aceita texto separado por ponto e vírgula.
- **Configuração**, à direita, em **Tempo de resposta**:
  - **Sim**: escolha quantos segundos cada pergunta fica aberta (de 5 a 300). Quem não responde no tempo fica sem o acerto.
  - **Não**: a pergunta fica aberta até você clicar em **Revelar**, ou até todos responderem.
- **Salvar quiz** grava na aba `Quizzes` da planilha. **Iniciar quiz** salva e abre o QR code.

A aba `Quizzes` guarda uma linha por pergunta (*Quiz, Nº, Pergunta, A, B, C, D, Correta*), então também dá para revisar ou editar pela planilha.

**Rankings**
- **Individual**: mais acertos. No empate, ganha quem somou menos tempo nas respostas certas.
- **Salas**: maior número total de respostas certas da sala.
- No ranking parcial (tecla **R**), use os botões **Os dois / Individual / Salas**. No pódio há botões para o ranking individual e para o das salas.

## 6. No dia da apresentação

| Ação | Como |
|---|---|
| Abrir o quiz | `host.html` → senha → editor → escolha o quiz e o tempo → **Iniciar quiz** (o QR code aparece) |
| Começar / avançar | Botão ou **Espaço** / **→** |
| Revelar a resposta | Automático quando o tempo acaba ou quando todos responderam, ou pelo botão **Revelar** |
| Ver as respostas de cada um | **P** (gaveta lateral) ou o painel privado `?painel=1` |
| Ranking parcial (individual e salas) | **R**, depois de revelar |
| Tela cheia | **F** |
| Recarregou a página? | Senha → **Continuar sessão em andamento** |

**Classificação:** conta o número de acertos. O tempo de cada resposta é medido pelo servidor e só serve para desempate.

**Privacidade:** o celular nunca recebe a resposta certa antes da revelação, nem as escolhas de outras pessoas. O telão mostra só totais por alternativa. Na gaveta de respostas, durante a pergunta, aparece apenas "respondeu"; as letras só aparecem depois da revelação. O painel privado mostra as letras o tempo todo.

**Capacidade:** o Google Apps Script atende bem até cerca de 150 participantes simultâneos (cada celular consulta o estado a cada ~2 s). Para eventos maiores, fale comigo para trocar o backend por um Firebase.

## Estrutura

```
index.html            tela do participante (celular)
host.html             tela do apresentador (telão) + ?painel=1
config.js             URL da planilha, título e lista de salas  ← único arquivo a editar
assets/
  engine.js           regras do jogo (as mesmas usadas no Apps Script)
  api.js              comunicação com a planilha / modo demonstração
  brand.js            logo animado, símbolo, ondas, mascote Brisa, confete
  brand-vectors.js    vetores traçados do manual de marca
  style.css           cores e tipografia da marca
  qrcode.js           gerador de QR code (MIT, Kazuhiko Arase)
apps-script/Code.gs   backend para colar no Google Apps Script
```

Tipografia: Fraunces (títulos) e Albert Sans, que substitui a Motiva Sans, licenciada. A Motiva Sans é usada automaticamente se estiver instalada no computador.
