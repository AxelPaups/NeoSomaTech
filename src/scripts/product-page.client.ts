import { renderPriceHtml, renderTitleHtml, renderMarqueeText } from '../lib/productPage';

/** Client-side interactions for /produits/[slug] */
document.addEventListener('DOMContentLoaded', () => {
	const root = document.querySelector('[data-product-page]');
	if (!root) return;

	const mainImg = document.getElementById('main-carousel-img') as HTMLImageElement | null;
	const counterCurrent = document.getElementById('gallery-counter-current');
	const counterTotal = document.getElementById('gallery-counter-total');
	const prevBtn = document.getElementById('prev-btn');
	const nextBtn = document.getElementById('next-btn');
	const carouselThumbnails = document.querySelector('.pp-thumbs');
	const priceBlock = document.getElementById('price-block-container');
	const panelPrice = document.getElementById('panel-price-block');
	const stickyPrice = document.getElementById('sticky-price-block');
	const shortDesc = document.querySelector('.pp-short-desc');
	const longDesc = document.querySelector('.pp-rich');
	const stickyDock = document.getElementById('pp-sticky-dock');
	const stageSection = document.getElementById('pp-stage');
	const specCards = root.querySelectorAll<HTMLElement>('.pp-spec-card[data-spec-key]');

	let currentIndex = 0;

	function getThumbnails() {
		return document.querySelectorAll('.pp-thumb-btn');
	}

	function updateCounter(index: number, total: number) {
		if (counterCurrent) counterCurrent.textContent = String(index + 1).padStart(2, '0');
		if (counterTotal) counterTotal.textContent = String(total).padStart(2, '0');
	}

	function updateCarousel(index: number) {
		const thumbs = getThumbnails();
		if (!mainImg || thumbs.length === 0) return;

		const newImage = thumbs[index].getAttribute('data-image');
		if (newImage) {
			mainImg.style.opacity = '0.4';
			mainImg.style.transform = 'scale(0.98)';
			setTimeout(() => {
				mainImg.src = newImage;
				const thumbImg = thumbs[index].querySelector('img');
				if (thumbImg) mainImg.alt = thumbImg.alt;
				mainImg.style.opacity = '1';
				mainImg.style.transform = 'scale(1)';
			}, 180);
		}

		thumbs.forEach((t) => t.classList.remove('active'));
		thumbs[index].classList.add('active');
		updateCounter(index, thumbs.length);
	}

	function attachThumbnailEvents() {
		getThumbnails().forEach((thumb, index) => {
			const clone = thumb.cloneNode(true) as HTMLElement;
			thumb.parentNode?.replaceChild(clone, thumb);
			clone.addEventListener('click', () => {
				currentIndex = index;
				updateCarousel(currentIndex);
			});
		});
	}

	if (mainImg && getThumbnails().length > 0) {
		attachThumbnailEvents();
		updateCounter(0, getThumbnails().length);

		prevBtn?.addEventListener('click', () => {
			const len = getThumbnails().length;
			currentIndex = currentIndex > 0 ? currentIndex - 1 : len - 1;
			updateCarousel(currentIndex);
		});

		nextBtn?.addEventListener('click', () => {
			const len = getThumbnails().length;
			currentIndex = currentIndex < len - 1 ? currentIndex + 1 : 0;
			updateCarousel(currentIndex);
		});

		// Parallax léger sur la galerie
		const galleryFrame = document.querySelector('.pp-gallery-frame');
		if (galleryFrame && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			galleryFrame.addEventListener('mousemove', (e) => {
				const rect = (galleryFrame as HTMLElement).getBoundingClientRect();
				const x = (e.clientX - rect.left) / rect.width - 0.5;
				const y = (e.clientY - rect.top) / rect.height - 0.5;
				if (mainImg) {
					mainImg.style.transform = `scale(1.03) translate(${x * 8}px, ${y * 8}px)`;
				}
			});
			galleryFrame.addEventListener('mouseleave', () => {
				if (mainImg) mainImg.style.transform = 'scale(1)';
			});
		}
	}

	// Scroll reveal
	const revealEls = root.querySelectorAll('.reveal');
	if (revealEls.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		const io = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						entry.target.classList.add('is-visible');
						io.unobserve(entry.target);
					}
				});
			},
			{ threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
		);
		revealEls.forEach((el) => io.observe(el));
	} else {
		revealEls.forEach((el) => el.classList.add('is-visible'));
	}

	// Sticky dock
	if (stickyDock && stageSection) {
		const dockObserver = new IntersectionObserver(
			([entry]) => {
				stickyDock.classList.toggle('is-visible', !entry.isIntersecting);
			},
			{ threshold: 0, rootMargin: '-80px 0px 0px 0px' },
		);
		dockObserver.observe(stageSection);
	}

	function syncAllPrices(html: string) {
		if (stickyPrice) stickyPrice.innerHTML = html;
		if (panelPrice) panelPrice.innerHTML = html;
	}

	function updateSpecsFromPayload(specsPayload: Record<string, string>) {
		if (!specCards || specCards.length === 0) return;

		specCards.forEach((card) => {
			const key = card.getAttribute('data-spec-key') || '';
			const raw = specsPayload[key] || '';
			const valueEl = card.querySelector<HTMLElement>('.pp-spec-value');

			if (!raw) {
				card.classList.add('is-hidden');
				if (valueEl) valueEl.textContent = '';
				return;
			}

			card.classList.remove('is-hidden');
			if (valueEl) valueEl.textContent = raw;
		});
	}

	function updateProductTitle(name: string) {
		const h1 = document.getElementById('pp-product-title');
		if (h1) h1.innerHTML = renderTitleHtml(name);
		document.title = `${name} | NeoSomaTech`;
		const crumb = document.getElementById('pp-crumb-name');
		if (crumb) crumb.textContent = name;
		const stickyName = document.getElementById('sticky-product-name');
		if (stickyName) stickyName.textContent = name;
		const descProduct = document.querySelector('.pp-description-product');
		if (descProduct) descProduct.textContent = name;
		const marqueeText = renderMarqueeText(name);
		document.querySelectorAll('.pp-marquee-text').forEach((s) => {
			s.textContent = marqueeText;
		});
	}

	// Variantes
	const variantBtns = document.querySelectorAll('.variant-btn');

	function selectVariant(btn: Element) {
			variantBtns.forEach((b) => b.classList.remove('active'));
			btn.classList.add('active');

			const newPrice = btn.getAttribute('data-price') || '';
			const isPromo = btn.getAttribute('data-promo') === 'true';
			const newPrixPromo = btn.getAttribute('data-prix-promo') || '';
			const newImage = btn.getAttribute('data-image');
			const newUrl = btn.getAttribute('data-url');
			const newAttente = btn.getAttribute('data-attente');
			const newDescShort = btn.getAttribute('data-desc-short');
			const newDescLong = btn.getAttribute('data-desc-long');
			const newName = btn.getAttribute('data-name');
			const newGalleryStr = btn.getAttribute('data-gallery');
			const newSpecsStr = btn.getAttribute('data-specs');

			if (newName) updateProductTitle(newName);

			const priceInner = renderPriceHtml(newPrice, isPromo, newPrixPromo);
			if (priceBlock) {
				const label = priceBlock.querySelector('.pp-price-label');
				priceBlock.innerHTML = label
					? `<div class="pp-price-label">${label.textContent}</div>${priceInner}`
					: priceInner;
			}
			syncAllPrices(priceInner);

			if (newImage && mainImg) {
				mainImg.style.opacity = '0.4';
				setTimeout(() => {
					mainImg.src = newImage;
					const firstThumb = carouselThumbnails?.querySelector('.pp-thumb-btn img') as HTMLImageElement | null;
					if (firstThumb) mainImg.alt = firstThumb.alt;
					mainImg.style.opacity = '1';
				}, 180);
			}

			const currentBuyBtn = document.getElementById('main-cta-btn');
			const stickyCta = document.getElementById('sticky-cta-btn');
			if (currentBuyBtn) {
				if (newPrice) {
					currentBuyBtn.outerHTML = `<a href="${newUrl || '#'}" class="btn btn-buy" id="main-cta-btn" target="${newUrl ? '_blank' : '_self'}" ${newUrl ? 'rel="noopener noreferrer"' : ''}>Acheter maintenant</a>`;
					if (stickyCta) {
						stickyCta.outerHTML = `<a href="${newUrl || '#'}" class="btn" id="sticky-cta-btn" target="_blank" rel="noopener noreferrer">Acheter</a>`;
					}
				} else {
					currentBuyBtn.outerHTML = `<button class="btn btn-buy btn-disabled tooltip-btn" id="main-cta-btn" data-tooltip="${newAttente || 'Bientôt disponible'}">Me notifier</button>`;
					if (stickyCta) {
						stickyCta.outerHTML = `<button class="btn btn-disabled" id="sticky-cta-btn" disabled>Bientôt</button>`;
					}
				}
			}

			if (shortDesc && newDescShort) shortDesc.textContent = newDescShort;
			if (longDesc && newDescLong) longDesc.innerHTML = newDescLong;

			if (carouselThumbnails && newGalleryStr) {
				try {
					const gallery = JSON.parse(newGalleryStr);
					if (Array.isArray(gallery) && gallery.length > 0) {
						const controls = document.querySelector('.pp-gallery-controls') as HTMLElement | null;
						if (controls) controls.style.display = gallery.length > 1 ? 'flex' : 'none';
						(carouselThumbnails as HTMLElement).style.display = gallery.length > 1 ? 'flex' : 'none';

						const productName = document.querySelector('.pp-title')?.textContent || 'Produit';
						carouselThumbnails.innerHTML = gallery
							.map(
								(imgUrl: string, index: number) => `
							<button class="pp-thumb-btn thumbnail-btn ${index === 0 ? 'active' : ''}" data-index="${index}" data-image="${imgUrl}" aria-label="Image ${index + 1}">
								<img src="${imgUrl}" alt="${productName} — vue ${index + 1}" width="72" height="72" loading="lazy" />
							</button>`,
							)
							.join('');

						attachThumbnailEvents();
						currentIndex = 0;
						updateCarousel(0);
					}
				} catch (e) {
					console.error('Galerie variante:', e);
				}
			}

			if (newSpecsStr) {
				try {
					const payload = JSON.parse(newSpecsStr) as Record<string, string>;
					updateSpecsFromPayload(payload);
				} catch (e) {
					console.error('Specs payload:', e);
				}
			}
	}

	variantBtns.forEach((btn) => {
		btn.addEventListener('click', () => selectVariant(btn));
	});

	// Sélecteurs Modèle / Taille (CAS 1)
	const modeleSelect = document.getElementById('pp-modele-select') as HTMLSelectElement | null;
	const tailleSelect = document.getElementById('pp-taille-select') as HTMLSelectElement | null;
	const TAILLE_ORDER = ['S', 'M', 'L'];

	if (modeleSelect && tailleSelect) {
		const variantData = Array.from(variantBtns).map((b) => ({
			el: b,
			modele: b.getAttribute('data-modele') || '',
			taille: b.getAttribute('data-taille') || '',
		}));

		function findVariant(modele: string, taille: string) {
			return variantData.find((v) => v.modele === modele && v.taille === taille)?.el;
		}

		function populateTailleOptions(modele: string, preferredTaille?: string) {
			const tailles = [...new Set(variantData.filter((v) => v.modele === modele).map((v) => v.taille))].sort(
				(a, b) => TAILLE_ORDER.indexOf(a) - TAILLE_ORDER.indexOf(b),
			);
			tailleSelect!.innerHTML = tailles.map((t) => `<option value="${t}">${t}</option>`).join('');
			tailleSelect!.value = preferredTaille && tailles.includes(preferredTaille) ? preferredTaille : tailles[0];
		}

		modeleSelect.addEventListener('change', () => {
			populateTailleOptions(modeleSelect.value);
			const match = findVariant(modeleSelect.value, tailleSelect.value);
			if (match) selectVariant(match);
		});

		tailleSelect.addEventListener('change', () => {
			const match = findVariant(modeleSelect.value, tailleSelect.value);
			if (match) selectVariant(match);
		});

		// État initial : première variante
		populateTailleOptions(modeleSelect.value);
		const initial = findVariant(modeleSelect.value, tailleSelect.value);
		if (initial) selectVariant(initial);
	}

	// Formulaire avis
	const avisForm = document.getElementById('avis-form') as HTMLFormElement | null;
	if (!avisForm) return;

	const starBtns = avisForm.querySelectorAll('.star-btn');
	const noteInput = document.getElementById('note-value') as HTMLInputElement | null;
	const prenomInput = document.getElementById('avis-prenom') as HTMLInputElement | null;
	const emailInput = document.getElementById('avis-email') as HTMLInputElement | null;
	const avisTexteInput = document.getElementById('avis-texte') as HTMLTextAreaElement | null;
	const submitBtn = document.getElementById('avis-submit') as HTMLButtonElement | null;
	const successMsg = document.getElementById('avis-success');
	const errorGlobal = document.getElementById('avis-error-global');

	let selectedNote = 0;

	starBtns.forEach((btn) => {
		const val = parseInt(btn.getAttribute('data-value') || '0');
		btn.addEventListener('mouseenter', () => {
			starBtns.forEach((b) => {
				const bVal = parseInt(b.getAttribute('data-value') || '0');
				b.classList.toggle('hover-preview', bVal <= val);
			});
		});
		btn.addEventListener('mouseleave', () => {
			starBtns.forEach((b) => {
				b.classList.remove('hover-preview');
				const bVal = parseInt(b.getAttribute('data-value') || '0');
				b.classList.toggle('active', bVal <= selectedNote);
			});
		});
		btn.addEventListener('click', () => {
			selectedNote = val;
			if (noteInput) noteInput.value = String(selectedNote);
			starBtns.forEach((b) => {
				const bVal = parseInt(b.getAttribute('data-value') || '0');
				b.classList.toggle('active', bVal <= selectedNote);
			});
			const noteError = document.getElementById('note-error');
			if (noteError) noteError.textContent = '';
		});
	});

	function validateField(
		input: HTMLInputElement | HTMLTextAreaElement,
		errorId: string,
		rules: { required?: boolean; email?: boolean },
	): boolean {
		const errorEl = document.getElementById(errorId);
		const val = input.value.trim();
		input.classList.remove('error', 'valid');
		if (rules.required && !val) {
			input.classList.add('error');
			if (errorEl) errorEl.textContent = 'Ce champ est obligatoire.';
			return false;
		}
		if (rules.email && val) {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(val)) {
				input.classList.add('error');
				if (errorEl) errorEl.textContent = 'Email invalide.';
				return false;
			}
		}
		input.classList.add('valid');
		if (errorEl) errorEl.textContent = '';
		return true;
	}

	prenomInput?.addEventListener('blur', () => prenomInput && validateField(prenomInput, 'prenom-error', { required: true }));
	emailInput?.addEventListener('blur', () => emailInput && validateField(emailInput, 'email-error', { required: true, email: true }));
	avisTexteInput?.addEventListener('blur', () => avisTexteInput && validateField(avisTexteInput, 'avis-texte-error', { required: true }));

	avisForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		let valid = true;
		if (selectedNote === 0) {
			const noteError = document.getElementById('note-error');
			if (noteError) noteError.textContent = 'Veuillez sélectionner une note.';
			valid = false;
		}
		if (prenomInput && !validateField(prenomInput, 'prenom-error', { required: true })) valid = false;
		if (emailInput && !validateField(emailInput, 'email-error', { required: true, email: true })) valid = false;
		if (avisTexteInput && !validateField(avisTexteInput, 'avis-texte-error', { required: true })) valid = false;
		if (!valid) return;

		if (submitBtn) {
			submitBtn.disabled = true;
			submitBtn.textContent = 'Envoi…';
		}
		if (successMsg) (successMsg as HTMLElement).style.display = 'none';
		if (errorGlobal) (errorGlobal as HTMLElement).style.display = 'none';

		const formData = new FormData(avisForm);
		const payload: Record<string, unknown> = {};
		formData.forEach((value, key) => {
			if (key === 'note') payload[key] = parseInt(value as string);
			else if ((value as string).trim() !== '') payload[key] = value;
		});

		try {
			const response = await fetch('/api/avis', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || `Erreur ${response.status}`);
			}
			avisForm.reset();
			selectedNote = 0;
			starBtns.forEach((b) => b.classList.remove('active', 'hover-preview'));
			if (noteInput) noteInput.value = '';
			if (successMsg) {
				(successMsg as HTMLElement).style.display = 'block';
				setTimeout(() => window.location.reload(), 2000);
			}
		} catch (err: unknown) {
			console.error('Avis:', err);
			if (errorGlobal) {
				errorGlobal.textContent = `⚠️ ${err instanceof Error ? err.message : 'Erreur'}`;
				(errorGlobal as HTMLElement).style.display = 'block';
			}
		} finally {
			if (submitBtn) {
				submitBtn.disabled = false;
				submitBtn.textContent = 'Envoyer mon avis';
			}
		}
	});
});
