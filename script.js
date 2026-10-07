document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener("click", function (event) {
            const target = document.querySelector(this.getAttribute("href"));
            if (target) {
                event.preventDefault();
                target.scrollIntoView({ behavior: "smooth" });
            }
        });
    });

    const API_BASE_URL = window.MFS_API_BASE_URL || "https://mfs-backend-hrjv.onrender.com";

    // MFS delivery center: Sai Serenity Layout, Seegehalli, Bengaluru.
    // The public website uses these as a safe fallback if the backend delivery-settings
    // endpoint is unavailable. Backend validation should remain the final authority.
    const DEFAULT_DELIVERY_SETTINGS = {
        enabled: true,
        latitude: 13.017409613389896,
        longitude: 77.7282541522543,
        radiusKm: 2.0,
        cutoffTime: "22:00",
        timezone: "Asia/Kolkata"
    };

    let deliverySettings = { ...DEFAULT_DELIVERY_SETTINGS };
    let checkedLocation = null;

    const fallbackTiffins = [
        { id: 1, name: "Idly", price: 40 },
        { id: 2, name: "Dosa", price: 50 },
        { id: 3, name: "Masala Dosa", price: 60 },
        { id: 4, name: "Onion Dosa", price: 60 },
        { id: 5, name: "Poori", price: 50 },
        { id: 6, name: "Pongal", price: 50 },
        { id: 7, name: "Lemon Rice", price: 50 },
        { id: 8, name: "Bonda", price: 40 },
        { id: 9, name: "Punugulu", price: 40 },
        { id: 10, name: "Vada", price: 40 },
        { id: 11, name: "Masala Vada", price: 40 },
        { id: 12, name: "Perugu Vada", price: 50 },
        { id: 13, name: "Chapathi", price: 50 },
        { id: 14, name: "Roti", price: 50 },
        { id: 15, name: "Uttapam", price: 60 },
        { id: 16, name: "Pesarattu", price: 60 }
    ];

    let tiffins = fallbackTiffins.slice();
    const quantities = {};

    const orderSection = document.getElementById("tiffin-order");
    const orderList = document.getElementById("tiffinOrderList");
    const cartItems = document.getElementById("tiffinCartItems");
    const cartTotal = document.getElementById("tiffinCartTotal");
    const foodTotal = document.getElementById("tiffinFoodTotal");
    const PACKING_CHARGE = 10;
    const payButton = document.getElementById("tiffinPayButton");
    const message = document.getElementById("tiffinOrderMessage");

    const openButton = document.getElementById("openTiffinOrder");
    const cutoffNotice = document.getElementById("tiffinCutoffNotice");
    const deliveryDateInput = document.getElementById("tiffinDeliveryDate");
    const deliverySlotInput = document.getElementById("tiffinDeliverySlot");
    const locationButton = document.getElementById("checkDeliveryLocation");
    const locationStatus = document.getElementById("deliveryLocationStatus");
    const latitudeInput = document.getElementById("tiffinLatitude");
    const longitudeInput = document.getElementById("tiffinLongitude");
    const distanceInput = document.getElementById("tiffinDistanceKm");

    function rupees(value) {
        return "₹" + Number(value || 0).toLocaleString("en-IN");
    }

    function getIndiaDateParts() {
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(new Date());

        const result = {};
        parts.forEach(function (part) {
            if (part.type !== "literal") result[part.type] = part.value;
        });
        return result;
    }

    function getIndiaHourMinute() {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23"
        }).formatToParts(new Date());

        const result = {};
        parts.forEach(function (part) {
            if (part.type !== "literal") result[part.type] = part.value;
        });
        return {
            hour: Number(result.hour),
            minute: Number(result.minute)
        };
    }

    function isOrderingOpen() {
        const now = getIndiaHourMinute();
        const cutoff = String(deliverySettings.cutoffTime || "22:00").split(":");
        const cutoffMinutes = (Number(cutoff[0]) * 60) + Number(cutoff[1] || 0);
        return (now.hour * 60 + now.minute) < cutoffMinutes;
    }

    function setTomorrowDate() {
        const indiaParts = getIndiaDateParts();
        const tomorrow = new Date(Date.UTC(
            Number(indiaParts.year),
            Number(indiaParts.month) - 1,
            Number(indiaParts.day) + 1
        ));
        const yyyy = tomorrow.getUTCFullYear();
        const mm = String(tomorrow.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(tomorrow.getUTCDate()).padStart(2, "0");
        deliveryDateInput.value = yyyy + "-" + mm + "-" + dd;
    }

    function updateOrderingAvailability() {
        const open = isOrderingOpen() && deliverySettings.enabled !== false;

        openButton.disabled = !open;
        if (deliverySettings.enabled === false) {
            openButton.textContent = "Delivery Temporarily Unavailable";
            cutoffNotice.textContent = "Tiffin delivery is currently unavailable.";
        } else {
            openButton.textContent = open ? "🛒 Order Tiffins" : "Orders Closed for Today";
            cutoffNotice.textContent = "Tomorrow's tiffin orders are closed for today. Please place your order before 10:00 PM.";
        }
        cutoffNotice.hidden = open;

        if (!open) {
            payButton.disabled = true;
        }
        return open;
    }

    function renderTiffins() {
        orderList.innerHTML = tiffins.map(function (item) {
            return `
                <div class="tiffin-item">
                    <div>
                        <div class="tiffin-item-name">${escapeHtml(item.name)}</div>
                        <div class="tiffin-item-price">${rupees(item.price)}</div>
                    </div>
                    <div class="qty-control">
                        <button type="button" data-action="minus" data-id="${item.id}" aria-label="Decrease ${escapeHtml(item.name)}">−</button>
                        <span id="qty-${item.id}">0</span>
                        <button type="button" data-action="plus" data-id="${item.id}" aria-label="Increase ${escapeHtml(item.name)}">+</button>
                    </div>
                </div>`;
        }).join("");
    }

    function updateCart() {
        const selected = tiffins.filter(function (item) {
            return (quantities[item.id] || 0) > 0;
        });
        let total = 0;

        selected.forEach(function (item) {
            total += item.price * quantities[item.id];
            const qtyEl = document.getElementById("qty-" + item.id);
            if (qtyEl) qtyEl.textContent = quantities[item.id];
        });

        tiffins.forEach(function (item) {
            if (!quantities[item.id]) {
                const qtyEl = document.getElementById("qty-" + item.id);
                if (qtyEl) qtyEl.textContent = "0";
            }
        });

        cartItems.innerHTML = selected.length
            ? selected.map(function (item) {
                return `<span>${escapeHtml(item.name)} × ${quantities[item.id]} — ${rupees(item.price * quantities[item.id])}</span>`;
            }).join("<br>")
            : "No items selected yet.";

        const packingCharge = selected.length ? PACKING_CHARGE : 0;
        const grandTotal = total + packingCharge;
        if (foodTotal) foodTotal.textContent = rupees(total);
        cartTotal.textContent = rupees(grandTotal);
        payButton.disabled = selected.length === 0 || !isOrderingOpen();
        return { selected: selected, total: grandTotal, foodTotal: total, packingCharge: packingCharge };
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function resetLocationCheck() {
        checkedLocation = null;
        latitudeInput.value = "";
        longitudeInput.value = "";
        distanceInput.value = "";
        locationStatus.className = "location-status";
        locationStatus.textContent = "Location not checked yet.";
    }

    function distanceInKm(lat1, lon1, lat2, lon2) {
        const earthRadiusKm = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function checkLocationPosition(position) {
        const latitude = Number(position.coords.latitude);
        const longitude = Number(position.coords.longitude);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            throw new Error("We could not read your current location. Please try again.");
        }

        const distance = distanceInKm(
            deliverySettings.latitude,
            deliverySettings.longitude,
            latitude,
            longitude
        );

        checkedLocation = {
            latitude: latitude,
            longitude: longitude,
            distanceKm: distance
        };

        latitudeInput.value = latitude.toFixed(8);
        longitudeInput.value = longitude.toFixed(8);
        distanceInput.value = distance.toFixed(3);

        const radius = Number(deliverySettings.radiusKm);
        if (distance <= radius) {
            locationStatus.className = "location-status success";
            locationStatus.textContent =
                "✓ Delivery available. You are approximately " +
                distance.toFixed(2) + " km from MFS (within " + radius.toFixed(1) + " km).";
        } else {
            locationStatus.className = "location-status error";
            locationStatus.textContent =
                "Sorry, we currently deliver only within " +
                radius.toFixed(1) + " km of MFS. Your location is approximately " +
                distance.toFixed(2) + " km away.";
        }

        return distance <= radius;
    }

    function requestDeliveryLocation() {
        if (!navigator.geolocation) {
            locationStatus.className = "location-status error";
            locationStatus.textContent = "Location is not supported by this browser. Please use a supported browser.";
            return;
        }

        locationButton.disabled = true;
        locationButton.textContent = "📍 Checking...";
        locationStatus.className = "location-status";
        locationStatus.textContent = "Checking your delivery location...";

        navigator.geolocation.getCurrentPosition(
            function (position) {
                try {
                    checkLocationPosition(position);
                } catch (error) {
                    locationStatus.className = "location-status error";
                    locationStatus.textContent = error.message;
                } finally {
                    locationButton.disabled = false;
                    locationButton.textContent = "📍 Check My Location Again";
                }
            },
            function (error) {
                let text = "Unable to get your location. Please allow location access and try again.";
                if (error && error.code === 1) {
                    text = "Location permission was denied. Please allow location access in your browser and try again.";
                } else if (error && error.code === 2) {
                    text = "Your location is currently unavailable. Please try again.";
                } else if (error && error.code === 3) {
                    text = "Location request timed out. Please try again.";
                }
                locationStatus.className = "location-status error";
                locationStatus.textContent = text;
                locationButton.disabled = false;
                locationButton.textContent = "📍 Use My Location";
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 300000
            }
        );
    }

    function validateOrderForm(cart) {
        if (!isOrderingOpen()) {
            return "Tiffin orders for tomorrow are closed after 10:00 PM. Please place your order before 10:00 PM.";
        }

        if (!cart.selected.length) return "Please select at least one tiffin.";

        const name = document.getElementById("tiffinCustomerName").value.trim();
        const mobile = document.getElementById("tiffinCustomerMobile").value.trim();
        const deliveryDate = deliveryDateInput.value;
        const deliverySlot = deliverySlotInput.value;
        const flatNumber = document.getElementById("tiffinFlatNumber").value.trim();
        const apartmentName = document.getElementById("tiffinApartmentName").value.trim();
        const landmark = document.getElementById("tiffinLandmark").value.trim();

        if (!name) return "Please enter your name.";
        if (!/^[0-9]{10}$/.test(mobile)) return "Please enter a valid 10-digit mobile number.";
        if (!deliveryDate) return "Delivery date is required.";
        if (!deliverySlot) return "Please select a delivery slot.";
        if (!flatNumber) return "Please enter your flat / house number.";
        if (!apartmentName) return "Please enter your apartment / building name.";
        if (!landmark) return "Please enter a landmark.";
        if (!checkedLocation) return "Please check your delivery location before proceeding to payment.";

        const radius = Number(deliverySettings.radiusKm);
        if (checkedLocation.distanceKm > radius) {
            return "Sorry, we currently deliver only within " + radius.toFixed(1) + " km of MFS.";
        }

        return "";
    }

    async function loadDeliverySettings() {
        // Try the public endpoint if the backend exposes it. If not, keep the exact
        // MFS center/radius fallback so the website remains usable.
        const endpoints = [
            "/api/delivery-settings",
            "/api/delivery/settings",
            "/api/config/delivery"
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(API_BASE_URL + endpoint, {
                    headers: { "Accept": "application/json" },
                    cache: "no-store"
                });
                if (!response.ok) continue;

                const data = await response.json();
                const source = data && data.data ? data.data : data;
                if (!source || typeof source !== "object") continue;

                const latitude = Number(source.latitude ?? source.centerLatitude ?? source.deliveryLatitude);
                const longitude = Number(source.longitude ?? source.centerLongitude ?? source.deliveryLongitude);
                const radiusKm = Number(source.radiusKm ?? source.deliveryRadiusKm ?? source.radius);
                const enabled = source.enabled ?? source.deliveryEnabled;

                if (Number.isFinite(latitude) && Number.isFinite(longitude) && Number.isFinite(radiusKm)) {
                    const enabledValue = enabled === undefined
                        ? true
                        : (typeof enabled === "string"
                            ? enabled.toLowerCase() !== "false"
                            : Boolean(enabled));

                    if (radiusKm <= 0) continue;

                    deliverySettings = {
                        ...deliverySettings,
                        latitude: latitude,
                        longitude: longitude,
                        radiusKm: radiusKm,
                        enabled: enabledValue,
                        cutoffTime: source.cutoffTime || source.orderCutoffTime || deliverySettings.cutoffTime,
                        timezone: source.timezone || deliverySettings.timezone
                    };
                    break;
                }
            } catch (error) {
                console.warn("Delivery settings endpoint unavailable:", endpoint);
            }
        }

        setTomorrowDate();
        updateOrderingAvailability();
    }

    async function loadTiffinsFromBackend() {
        orderList.innerHTML = '<div class="tiffin-loading">Loading tiffins...</div>';

        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
                const response = await fetch(API_BASE_URL + "/api/breakfast", {
                    headers: { "Accept": "application/json" },
                    cache: "no-store"
                });
                if (!response.ok) throw new Error("Breakfast API returned " + response.status);

                const data = await response.json();
                if (!Array.isArray(data)) throw new Error("Invalid breakfast API response");

                const availableItems = data.filter(function (item) {
                    return item.available !== false;
                });

                if (availableItems.length > 0) {
                    tiffins = availableItems.map(function (item) {
                        return {
                            id: Number(item.id),
                            name: item.name,
                            price: Number(item.price)
                        };
                    });
                }

                renderTiffins();
                updateCart();
                return;
            } catch (error) {
                console.warn("Breakfast API attempt " + attempt + " failed.", error);
                if (attempt < 3) {
                    await new Promise(function (resolve) {
                        setTimeout(resolve, attempt * 900);
                    });
                }
            }
        }

        renderTiffins();
        updateCart();
    }

    openButton.addEventListener("click", function () {
        if (!updateOrderingAvailability()) {
            message.textContent = "Tiffin orders for tomorrow are closed after 10:00 PM. Please place your order before 10:00 PM.";
            return;
        }
        setTomorrowDate();
        resetLocationCheck();
        orderSection.hidden = false;
        orderSection.scrollIntoView({ behavior: "smooth", block: "start" });
        message.textContent = "";
    });

    document.getElementById("closeTiffinOrder").addEventListener("click", function () {
        orderSection.hidden = true;
    });

    orderList.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const id = Number(button.dataset.id);
        const action = button.dataset.action;
        quantities[id] = quantities[id] || 0;

        if (action === "plus") quantities[id] += 1;
        if (action === "minus") quantities[id] = Math.max(0, quantities[id] - 1);

        updateCart();
    });

    [deliverySlotInput].forEach(function (field) {
        field.addEventListener("change", function () {
            message.textContent = "";
        });
    });

    ["tiffinCustomerName", "tiffinCustomerMobile", "tiffinFlatNumber", "tiffinApartmentName", "tiffinLandmark"].forEach(function (id) {
        document.getElementById(id).addEventListener("input", function () {
            message.textContent = "";
        });
    });

    locationButton.addEventListener("click", requestDeliveryLocation);

    async function startRazorpayPayment() {
        if (!updateOrderingAvailability()) {
            message.textContent = "Tiffin orders for tomorrow are closed after 10:00 PM. Please place your order before 10:00 PM.";
            return;
        }

        const cart = updateCart();
        const validationMessage = validateOrderForm(cart);
        if (validationMessage) {
            message.textContent = validationMessage;
            return;
        }

        const name = document.getElementById("tiffinCustomerName").value.trim();
        const mobile = document.getElementById("tiffinCustomerMobile").value.trim();
        const deliveryDate = deliveryDateInput.value;
        const deliverySlot = deliverySlotInput.value;
        const flatNumber = document.getElementById("tiffinFlatNumber").value.trim();
        const apartmentName = document.getElementById("tiffinApartmentName").value.trim();
        const landmark = document.getElementById("tiffinLandmark").value.trim();

        payButton.disabled = true;
        message.textContent = "Creating your order...";

        const request = {
            customerName: name,
            mobileNumber: mobile,
            deliveryDate: deliveryDate,
            deliverySlot: deliverySlot,
            flatNumber: flatNumber,
            apartmentName: apartmentName,
            landmark: landmark,
            items: cart.selected.map(function (item) {
                return {
                    breakfastItemId: item.id,
                    quantity: quantities[item.id]
                };
            })
        };

        // The backend performs the final delivery-radius validation.
        // Always send the coordinates returned by the browser so the backend
        // can validate the order against the current admin-configured radius.
        request.deliveryLatitude = checkedLocation.latitude;
        request.deliveryLongitude = checkedLocation.longitude;

        try {
            const response = await fetch(API_BASE_URL + "/api/payments/razorpay/order", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(request)
            });

            const data = await response.json().catch(function () { return {}; });
            if (!response.ok) {
                throw new Error(data.message || "Unable to create payment order.");
            }

            if (!window.Razorpay) {
                throw new Error("Razorpay Checkout could not be loaded. Please try again.");
            }

            const options = {
                key: data.keyId,
                amount: data.amount,
                currency: data.currency || "INR",
                name: "Mahalakshmi Food Services",
                description: "Tiffin Order " + data.orderNumber,
                order_id: data.razorpayOrderId,
                prefill: {
                    name: name,
                    contact: mobile
                },
                notes: {
                    mfs_order_number: data.orderNumber,
                    delivery_date: deliveryDate,
                    delivery_slot: deliverySlot
                },
                theme: { color: "#9f2d24" },
                handler: async function (payment) {
                    await verifyRazorpayPayment(data.orderNumber, payment);
                },
                modal: {
                    ondismiss: function () {
                        message.textContent = "Payment window closed. Your order is still pending payment.";
                        payButton.disabled = false;
                    }
                }
            };

            const razorpay = new Razorpay(options);
            razorpay.on("payment.failed", function (failure) {
                message.textContent = failure.error && failure.error.description
                    ? "Payment failed: " + failure.error.description
                    : "Payment failed. Please try again.";
                payButton.disabled = false;
            });
            razorpay.open();
        } catch (error) {
            console.error(error);
            message.textContent = error.message || "Unable to start payment. Please try again.";
            payButton.disabled = false;
        }
    }

    async function verifyRazorpayPayment(orderNumber, payment) {
        message.textContent = "Verifying payment...";

        try {
            const response = await fetch(API_BASE_URL + "/api/payments/razorpay/verify", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    orderNumber: orderNumber,
                    razorpayOrderId: payment.razorpay_order_id,
                    razorpayPaymentId: payment.razorpay_payment_id,
                    razorpaySignature: payment.razorpay_signature
                })
            });

            const data = await response.json().catch(function () { return {}; });
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Payment verification failed.");
            }

            message.textContent = "Payment successful! Order " + data.orderNumber + " is confirmed.";
            payButton.textContent = "Payment Completed";
            payButton.disabled = true;
        } catch (error) {
            console.error(error);
            message.textContent = error.message || "Payment verification failed. Please contact MFS.";
            payButton.disabled = false;
        }
    }

    payButton.addEventListener("click", startRazorpayPayment);

    setTomorrowDate();
    updateOrderingAvailability();
    setInterval(updateOrderingAvailability, 30000);

    renderTiffins();
    updateCart();

    Promise.all([
        loadDeliverySettings(),
        loadTiffinsFromBackend()
    ]);
});
