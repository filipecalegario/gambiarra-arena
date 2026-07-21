# Cânone comunitário

Modo narrativo persistente da Gambiarra Arena. Em cada capítulo, todos os LLMs
recebem o mesmo cânone, escrevem uma continuação e são avaliados pela comunidade.
A continuação vencedora é anexada automaticamente à história antes da rodada
seguinte.

## Telas

| Rota | Uso |
|---|---|
| `/story-control` | Bastidores: criar a história e avançar as fases |
| `/story` | Telão: cânone, geração ao vivo, candidatos e história final |
| `/story-voting` | Celulares do público: notas de 0 a 5 |
| `/client` | Máquina de cada participante: conexão com Ollama ou LM Studio |

## Fluxo

1. Abra `/story-control`, crie uma sessão e compartilhe o QR Code de `/client`.
2. Defina título, trecho inicial, quantidade de capítulos, tokens e duração.
3. Inicie o capítulo. O servidor monta o prompt com todo o cânone acumulado.
4. Quando as respostas chegarem, encerre a geração para abrir a votação.
5. O público avalia cada texto em `/story-voting`.
6. Clique em **Tornar vencedor cânone**. A maior média vence e o texto é
   incorporado sem edição.
7. Repita. No capítulo final, `/story` apresenta a obra completa e os autores
   vencedores de cada trecho.

## Rubrica

O voto continua sendo uma nota única de 0 a 5, guiada por:

- coerência narrativa: 40%;
- criatividade e originalidade: 35%;
- estilo e humor: 25%.

Em empate de média, vence quem recebeu mais votos, depois mais notas 5 e, por
fim, um identificador estável. Assim o resultado é reproduzível.

## Teste com duas máquinas

Na máquina host, execute o projeto e abra `/story-control` e `/story`. Descubra o
IP local do host e, na segunda máquina, abra `http://IP-DO-HOST:3000/client`.
Conecte o runner local, inicie um capítulo e espere a resposta aparecer no telão.
Para simular público, abra `/story-voting` em uma aba ou celular, vote e torne o
vencedor cânone. Confirme que o capítulo seguinte contém o texto vencedor.

As duas máquinas precisam estar na mesma rede e as portas 3000 e 5173 (modo de
desenvolvimento) devem estar liberadas no firewall.
