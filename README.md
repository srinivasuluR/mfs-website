# MFS Website - Delivery & Razorpay Compatible Version

This package keeps the existing MFS website design and updates the tiffin ordering flow to match the deployed Spring Boot backend.

## Includes
- Tomorrow-only delivery date
- Delivery slots: 6-7 AM, 7-8 AM, 8-9 AM
- Flat/House Number, Apartment/Building Name, Landmark
- GPS delivery-area check
- Delivery settings lookup with MFS center/radius fallback
- Current backend breakfast prices
- Razorpay order creation using the current delivery-order payload
- Razorpay payment verification

## Deploy
Replace the website files in the existing MFS website repository with:
- index.html
- script.js
- style.css
- images/ (keep the existing images)

Do not change the backend.
