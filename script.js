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

    // The public site can point to a deployed MFS API by setting:
    // window.MFS_API_BASE_URL = "https://api.mahalakshmifoodservices.in"
    // before this script loads. Local development uses Spring Boot on port 8080.
    const API_BASE_URL = window.MFS_API_BASE_URL || "https://mfs-backend-hrjv.onrender.com";

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
    const payButton = document.getElementById("tiffinPayButton");
    const message = document.getElementById("tiffinOrderMessage");

    function rupees(value) {
        return "₹" + value.toLocaleString("en-IN");
    }

    function renderTiffins() {
        orderList.innerHTML = tiffins.map(function (item) {
            return `
                <div class="tiffin-item">
                    <div>
                        <div class="tiffin-item-name">${item.name}</div>
                        <div class="tiffin-item-price">${rupees(item.price)}</div>
                    </div>
                    <div class="qty-control">
                        <button type="button" data-action="minus" data-id="${item.id}" aria-label="Decrease ${item.name}">−</button>
                        <span id="qty-${item.id}">0</span>
                        <button type="button" data-action="plus" data-id="${item.id}" aria-label="Increase ${item.name}">+</button>
                    </div>
                </div>`;
        }).join("");
    }

    function updateCart() {
        const selected = tiffins.filter(function (item) { return (quantities[item.id] || 0) > 0; });
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
                return `<span>${item.name} × ${quantities[item.id]} — ${rupees(item.price * quantities[item.id])}</span>`;
            }).join("<br>")
            : "No items selected yet.";

        cartTotal.textContent = rupees(total);
        payButton.disabled = selected.length === 0;
        return { selected: selected, total: total };
    }

    document.getElementById("openTiffinOrder").addEventListener("click", function () {
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

    async function loadTiffinsFromBackend() {
        try {
            const response = await fetch(API_BASE_URL + "/api/breakfast", {
                headers: { "Accept": "application/json" }
            });
            if (!response.ok) throw new Error("Breakfast API returned " + response.status);
            const data = await response.json();
            if (Array.isArray(data)) {
                const availableItems = data.filter(function (item) {
                    return item.available !== false;
                });
                tiffins = availableItems.map(function (item) {
                    return {
                        id: Number(item.id),
                        name: item.name,
                        price: Number(item.price)
                    };
                });
            }
        } catch (error) {
            console.warn("MFS API not available; showing fallback tiffin prices.", error);
        }
        renderTiffins();
        updateCart();
    }

    async function startRazorpayPayment() {
        const cart = updateCart();
        const name = document.getElementById("tiffinCustomerName").value.trim();
        const mobile = document.getElementById("tiffinCustomerMobile").value.trim();
        const pickup = document.getElementById("tiffinPickupTime").value;

        if (!cart.selected.length) {
            message.textContent = "Please select at least one tiffin.";
            return;
        }
        if (!name) {
            message.textContent = "Please enter your name.";
            return;
        }
        if (!/^[0-9]{10}$/.test(mobile)) {
            message.textContent = "Please enter a valid 10-digit mobile number.";
            return;
        }
        if (!pickup) {
            message.textContent = "Please select a pickup time.";
            return;
        }

        payButton.disabled = true;
        message.textContent = "Creating your order...";

        const request = {
            customerName: name,
            mobileNumber: mobile,
            pickupTime: pickup,
            items: cart.selected.map(function (item) {
                return { breakfastItemId: item.id, quantity: quantities[item.id] };
            })
        };

        try {
            const response = await fetch(API_BASE_URL + "/api/payments/razorpay/order", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
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
                    pickup_time: pickup
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
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
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

    loadTiffinsFromBackend();
});
