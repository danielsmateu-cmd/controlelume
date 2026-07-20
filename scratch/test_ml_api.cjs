const itemId = 'MLB3617637827';
const url = `https://api.mercadolibre.com/items/${itemId}`;

fetch(url)
  .then(res => res.json())
  .then(data => {
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(err => console.error(err));
