// Loads Razorpay's Checkout script on first use (only the payment page needs it).
const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loading = null;

export const loadRazorpayCheckout = () => {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = CHECKOUT_SRC;
      script.async = true;
      script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Razorpay unavailable")));
      script.onerror = () => {
        loading = null; // allow a retry
        script.remove();
        reject(new Error("Could not load Razorpay Checkout"));
      };
      document.body.appendChild(script);
    });
  }
  return loading;
};
