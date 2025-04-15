import React from 'react';
// Import Link for potential links within the static text (e.g., to general Terms or Privacy)
import { Link } from 'react-router-dom';

/**
 * UV_StaticVendorTerms Component
 *
 * Displays the static Vendor Terms of Service page.
 * This content is essential for operators signing up and using the platform.
 */
const UV_StaticVendorTerms: React.FC = () => {
  // This component only displays static content. No state or effects are needed.
  // The legal text below is placeholder content and should be replaced with the official terms.

  return (
    <>
      {/* Main container for the page content */}
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Card-like container for the terms text */}
        <div className="bg-white shadow-md rounded-lg p-6 md:p-10 max-w-4xl mx-auto">
          {/* Page Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 border-b border-gray-200 pb-4">
            Vendor Terms of Service
          </h1>

          {/* Scrollable content area with prose styling for readability */}
          {/* Assumes @tailwindcss/typography plugin is installed for 'prose' classes */}
          {/* If not, replace 'prose' with manual Tailwind typography classes */}
          <div className="prose prose-sm sm:prose lg:prose-lg max-w-none text-gray-700 leading-relaxed">
            {/* --- Placeholder Legal Content Start --- */}
            {/* Replace everything below this line with the actual Vendor Terms */}

            <p className="text-xs text-gray-500 mb-5">Last Updated: October 27, 2023</p>

            <p>
              Please read these Vendor Terms of Service ("Vendor Terms," "Terms") carefully before accessing or using the StreetEats Hub platform ("Platform") as a food truck operator or vendor ("Vendor," "you," "your"). These Terms govern your relationship with StreetEats Hub ("we," "us," "our").
            </p>
            <p>
              By registering for, accessing, or using the Platform, you acknowledge that you have read, understood, and agree to be bound by these Vendor Terms, as well as our general <Link to="/terms" className="text-blue-600 hover:text-blue-800 hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-blue-600 hover:text-blue-800 hover:underline">Privacy Policy</Link>, which are incorporated by reference into these Vendor Terms. If you do not agree to these Terms, you may not access or use the Platform as a Vendor.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">1. Account & Eligibility</h2>
            <p>
              1.1. **Registration:** You must create an account to use the Platform as a Vendor. You agree to provide accurate, complete, and current information during registration and to keep this information updated.
            </p>
            <p>
              1.2. **Eligibility:** You represent and warrant that you have the legal authority to operate your food truck business, possess all necessary licenses, permits, and insurance required by law, and have the authority to bind your business to these Terms.
            </p>
            <p>
              1.3. **Account Security:** You are responsible for maintaining the confidentiality of your account password and for all activities under your account. You must notify us immediately of any unauthorized use.
            </p>
             <p>
              1.4. **Email Verification:** Access to certain features, including payout configuration and accepting orders, requires verification of your registered email address.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">2. Platform Use & Responsibilities</h2>
            <p>
              2.1. **Service:** We grant you a limited, non-exclusive, non-transferable license to access and use the Platform solely for managing your food truck's online presence, menu, orders, and related operational aspects as intended by the Platform's features.
            </p>
            <p>
              2.2. **Your Responsibilities:** You are solely responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Accurately managing your truck's profile, menu items (including descriptions, pricing, ingredients, allergens where applicable, and photos), and availability.</li>
              <li>Accurately setting and updating your truck's operating status (Online/Offline/Paused) and current physical location via the Platform dashboard.</li>
              <li>Promptly monitoring, accepting, or rejecting incoming orders received through the Platform.</li>
              <li>Accurately updating the status of accepted orders (e.g., Preparing, Ready for Pickup, Out for Delivery, Completed/Delivered).</li>
              <li>Preparing all food items safely, hygienically, and in compliance with all applicable food safety laws and regulations.</li>
              <li>Fulfilling accepted orders accurately and providing a positive customer experience.</li>
              <li>If offering delivery, accurately defining your delivery settings (zone, fee, minimum order) and executing the delivery service reliably and safely, whether performed by you or your staff. StreetEats Hub is not a delivery provider.</li>
              <li>Complying with all applicable laws and regulations regarding your business operations, employment, food service, and taxation.</li>
              <li>Resolving any customer complaints or issues related to your food or service directly with the customer, though StreetEats Hub may facilitate communication.</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">3. Orders, Payments & Payouts</h2>
            <p>
              3.1. **Orders:** The Platform facilitates order placement by customers. You agree to fulfill all orders you accept through the Platform according to the details provided.
            </p>
            <p>
              3.2. **Payment Processing:** Customer payments are processed through our third-party payment processor (e.g., Stripe). By using the Platform, you agree to the payment processor's terms and conditions.
            </p>
            <p>
              3.3. **Fees:** We may charge a service fee or commission on orders processed via the Platform ("Service Fee"). The applicable Service Fee structure will be communicated to you separately or within the Platform dashboard. Service Fees will be deducted from your payouts.
            </p>
            <p>
              3.4. **Payouts:** To receive payouts (order totals minus Service Fees and any applicable transaction fees), you must successfully complete the payout configuration process via the Platform, providing accurate bank account and identification information as required by our payment processor. Payouts are subject to the processor's schedule and verification requirements. You are responsible for ensuring your payout information is kept current.
            </p>
            <p>
              3.5. **Taxes:** You are solely responsible for determining and remitting all applicable taxes (e.g., sales tax, income tax) on your earnings generated through the Platform.
            </p>
            <p>
              3.6. **Refunds:** You authorize us and our payment processor to process refunds to customers for orders that you reject, cancel after acceptance, or where a refund is deemed appropriate due to significant issues with the order fulfillment, consistent with our platform policies. Chargebacks initiated by customers may be deducted from your payouts.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">4. Content & Data</h2>
            <p>
              4.1. **Your Content:** You grant StreetEats Hub a worldwide, non-exclusive, royalty-free license to use, display, reproduce, and distribute the content you upload (logos, photos, menu descriptions, etc.) on the Platform and for marketing purposes related to the Platform. You represent that you own or have the necessary rights to grant this license.
            </p>
            <p>
              4.2. **Platform Data:** You acknowledge that StreetEats Hub owns all data generated by the Platform itself, including aggregated and anonymized usage data. Customer personal information obtained through the Platform must be handled in accordance with our Privacy Policy and applicable data protection laws.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">5. Disclaimers</h2>
            <p>
              THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE. WE ARE NOT RESPONSIBLE FOR THE QUALITY, SAFETY, OR LEGALITY OF THE FOOD YOU PROVIDE, NOR FOR THE ACTIONS OR OMISSIONS OF CUSTOMERS OR DELIVERY PERSONNEL.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">6. Limitation of Liability</h2>
            <p>
              TO THE FULLEST EXTENT PERMITTED BY LAW, STREETEATS HUB SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (A) YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE PLATFORM; (B) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE PLATFORM; OR (C) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT. IN NO EVENT SHALL STREETEATS HUB'S AGGREGATE LIABILITY EXCEED THE GREATER OF ONE HUNDRED U.S. DOLLARS (USD $100.00) OR THE AMOUNT OF SERVICE FEES PAID BY YOU TO STREETEATS HUB IN THE PAST SIX MONTHS.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">7. Indemnification</h2>
            <p>
              You agree to defend, indemnify, and hold harmless StreetEats Hub, its affiliates, officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with (a) your access to or use of the Platform; (b) your violation of these Vendor Terms; (c) your violation of any third-party right, including any intellectual property or privacy right; or (d) any claim related to the food, service, or delivery you provide.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">8. Termination</h2>
            <p>
              We may terminate or suspend your account and access to the Platform immediately, without prior notice or liability, for any reason, including breach of these Terms. Upon termination, your right to use the Platform will cease immediately. You may terminate your account by following the instructions on the Platform or contacting support. Provisions that by their nature should survive termination shall survive (including ownership, warranty disclaimers, indemnity, and limitations of liability).
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">9. General Terms</h2>
            <p>
              9.1. **Governing Law:** These Terms shall be governed by the laws of [Your Jurisdiction - e.g., State of California], without regard to its conflict of laws principles.
            </p>
            <p>
              9.2. **Changes to Terms:** We reserve the right to modify these Terms at any time. We will notify you of material changes. Continued use of the Platform after changes constitutes acceptance.
            </p>
            <p>
              9.3. **Entire Agreement:** These Terms constitute the entire agreement between you and StreetEats Hub regarding the Platform use as a Vendor.
            </p>
            <p>
              9.4. **Contact:** For questions about these Terms, contact us at [Your Support Email or Link to Contact Page].
            </p>

            {/* --- Placeholder Legal Content End --- */}
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_StaticVendorTerms;