function showCard(card) {
    const cardsDiv = document.getElementById('cards');

    const wrapper = document.createElement('div');
    wrapper.className = 'card-wrapper';

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    const back = document.createElement('div');
    back.className = 'card-face card-back';
    back.innerText = '🂠';

    const front = document.createElement('div');
    front.className = `card-face card-front card ${card.rarity}`;

    const imgSrc = `images/card${card.cardId}.png`;

    front.innerHTML = `
        <img src="${imgSrc}">
        <div><b>Карта #${card.cardId}</b></div>
        <div>${card.rarity.toUpperCase()}</div>
        <button onclick="createListing(${card.id}, 100)">Продать</button>
    `;

    inner.appendChild(back);
    inner.appendChild(front);
    wrapper.appendChild(inner);
    cardsDiv.appendChild(wrapper);

    setTimeout(() => {
        wrapper.classList.add('open');
    }, 300);
}