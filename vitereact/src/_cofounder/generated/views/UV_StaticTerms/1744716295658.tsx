import React from 'react';
// No Link import needed as this page doesn't navigate away actively.
// No global state imports needed.
// No API client needed.

const UV_StaticTerms: React.FC = () => {
  return (
    <>
      <div className="bg-white py-12 px-4 sm:px-6 lg:px-8 min-h-[calc(100vh-10rem)]"> {/* Adjust min-height based on header/footer */}
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Terms of Service
          </h1>

          <div className="text-gray-700 space-y-6">
            <p className="text-sm text-gray-500">Last Updated: October 27, 2023</p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-6 mb-4">1. Acceptance of Terms</h2>
            <p>
              Welcome to StreetEats Hub ("we," "us," or "our"). By accessing or using our web application (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Service. These Terms apply to all visitors, users, and others who access or use the Service, including Customers and Food Truck Operators.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-6 mb-4">2. Description of Service</h2>
            <p>
              StreetEats Hub provides an online platform connecting customers ("Customers") with independent food truck operators ("Operators") to facilitate the ordering of food and beverages ("Orders") for pickup or delivery. We are a marketplace platform and are not responsible for the preparation, quality, or delivery of food provided by Operators.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-6 mb-4">3. User Accounts</h2>
            <h3 className="text-xl font-medium text-gray-800 mt-4 mb-2">3.1. Registration</h3>
            <p>
              To use certain features of the Service (like placing orders or managing a food truck), you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete.
            </p>
            <h3 className="text-xl font-medium text-gray-800 mt-4 mb-2">3.2. Account Security</h3>
            <p>
              You are responsible for safeguarding your password and any activities or actions under your account. We encourage you to use a "strong" password (passwords that use a combination of upper and lower case letters, numbers, and symbols). You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-6 mb-4">4. Customer Terms</h2>
            <h3 className="text-xl font-medium text-gray-800 mt-4 mb-2">4.1. Ordering</h3>
            <p>
              When you place an Order through the Service, you are making an offer to purchase products from the selected Operator. The Operator may accept or reject your Order. Once accepted, a contract is formed between you and the Operator. All Orders are subject to availability.
            </p>
            <h3 className="text-xl font-medium text-gray-800 mt-4 mb-2">4.2. Payment</h3>
            <p>
              You agree to pay for all Orders placed through your account using the payment methods available on the Service. Payments are processed through a third-party payment processor (e.g., Stripe). We are not responsible for payment processing errors. Prices listed on the Service are determined by the Operators and may include applicable taxes and fees (like delivery fees).
            </p>
            <h3 className="text-xl font-medium text-gray-800 mt-4 mb-2">4.3. Pickup and Delivery</h3>
            <p>
              You are responsible for collecting your pickup Orders at the designated time and location. For delivery Orders, you must provide an accurate delivery address within the Operator's specified delivery zone. Delivery times are estimates and not guaranteed. The Operator is solely responsible for fulfilling the Order, including delivery if applicable.
            </p>
            <h3 className="text-xl font-medium text-gray-800 mt-4 mb-2">4.4. Cancellations and Refunds</h3>
            <p>
              Cancellation policies are limited. You may request cancellation only before the Operator begins preparing the Order (typically shortly after acceptance). Operators may cancel Orders under certain circumstances (e.g., item unavailability). Refunds for cancelled or rejected Orders will be processed according to our refund policy and payment processor capabilities. Issues regarding food quality or order accuracy should be directed to the Operator first, though you may contact us for assistance in facilitating communication.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-6 mb-4">5. Operator Terms</h2>
            <p>
              Operators using the Service are subject to additional terms outlined in the Vendor Terms of Service, which must be agreed to during Operator registration. These include responsibilities regarding menu accuracy, order fulfillment, food safety, payment processing, and adherence to local regulations.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-6 mb-4">6. Prohibited Conduct</h2>
            <p>You agree not to engage in any of the following prohibited activities:</p>
            <ul className="list-disc list-inside space-y-1 pl-4">
              <li>Using the Service for any illegal purpose or in violation of any local, state, national, or international law.</li>
              <li>Violating or encouraging others to violate the rights of third parties, including intellectual property rights.</li>
              <li>Posting, uploading, or distributing any content that is unlawful, defamatory, libelous, inaccurate, or that a reasonable person could deem to be objectionable, profane, indecent, pornographic, harassing, threatening, hateful, or otherwise inappropriate.</li>
              <li>Interfering with security-related features of the Service.</li>
              <li>Interfering with the operation of the Service or any user's enjoyment of it, including by uploading or otherwise disseminating viruses, adware, spyware, worms, or other malicious code.</li>
              <li>Attempting to collect personal information about users or third parties without their consent.</li>
              <li>Accessing, tampering with, or using non-public areas of the Service, our computer systems, or the technical delivery systems of our providers.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-800 mt-6 mb-4">7. Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE. WE ARE NOT RESPONSIBLE FOR THE ACTIONS, PRODUCTS, OR SERVICES OF THE FOOD TRUCK OPERATORS. ANY DISPUTES REGARDING ORDERS MUST BE RESOLVED DIRECTLY BETWEEN THE CUSTOMER AND THE OPERATOR.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-6 mb-4">8. Limitation of Liability</h2>
            <p>
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL STREETEATS HUB, ITS AFFILIATES, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING WITHOUT LIMITATION DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATING TO THE USE OF, OR INABILITY TO USE, THE SERVICE.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-6 mb-4">9. Indemnification</h2>
            <p>
              You agree to defend, indemnify, and hold harmless StreetEats Hub and its licensee and licensors, and their employees, contractors, agents, officers, and directors, from and against any and all claims, damages, obligations, losses, liabilities, costs or debt, and expenses (including but not limited to attorney's fees), resulting from or arising out of a) your use and access of the Service, by you or any person using your account and password; b) a breach of these Terms, or c) Content posted on the Service.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-6 mb-4">10. Governing Law</h2>
            <p>
              These Terms shall be governed and construed in accordance with the laws of [Your Jurisdiction - e.g., State of California, USA], without regard to its conflict of law provisions.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-6 mb-4">11. Changes to Terms</h2>
            <p>
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion. By continuing to access or use our Service after any revisions become effective, you agree to be bound by the revised terms.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-6 mb-4">12. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at [Your Contact Email or Link to Contact Page].
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_StaticTerms;