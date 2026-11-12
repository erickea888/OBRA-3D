# Obra 3D – Acompanhamento de montagem (CAG)

Modelo 3D, gerado a partir da planta de montagem, para acompanhar o avanço da obra:
tubulações e dutos em metros concluídos, equipamentos/válvulas/flanges por situação,
checklist de instalação de válvulas e bombas (flanges, juntas, parafusos, volante/alavanca),
linha do tempo da evolução e modo de andar pela planta.

## Como rodar
Requer Python 3. Dê dois cliques em `iniciar.bat` ou:

    py server.py 8080

Abra http://localhost:8080. Os registros ficam em `data/state.json` (fora do Git), com backup diário em `data/backup/`.

## Arquivos
- `model.js` – peças, posições (coordenadas da planta) e elevações; edite aqui para ajustar.
- `app.js` – visualização 3D e interface.
- `planta.jpg` – planta usada como piso.
- `server.py` – servidor local que salva os registros.
