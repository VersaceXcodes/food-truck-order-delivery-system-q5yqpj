import React from 'react';
// Import Link in case it's needed for internal links within the policy text in the future.
// import { Link } from 'react-router-dom';

/**
 * UV_StaticPrivacy Component
 *
 * Displays the static Privacy Policy page content.
 * Linked from the footer and signup pages.
 */
const UV_StaticPrivacy: React.FC = () => {
  // No local state or actions needed for this static view.
  // Content is hardcoded below.

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-2">
          Privacy Policy
        </h1>

        <div className="prose prose-lg max-w-none text-gray-700 space-y-4">
          {/* Use prose classes from @tailwindcss/typography for nice defaults if installed */}
          {/* Or use standard Tailwind classes */}

          <p className="text-sm text-gray-500">Last Updated: October 27, 2023</p>

          <p>
            Welcome to StreetEats Hub! This Privacy Policy explains how we
            collect, use, disclose, and safeguard your information when you use
            our web application (the "Service"). Please read this privacy policy
            carefully. If you do not agree with the terms of this privacy
            policy, please do not access the Service.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-3">
            Collection of Your Information
          </h2>
          <p>
            We may collect information about you in a variety of ways. The
            information we may collect via the Service includes:
          </p>
          <ul className="list-disc list-outside ml-6 space-y-2">
            <li>
              <strong>Personal Data:</strong> Personally identifiable
              information, such as your name, email address, phone number, and
              demographic information, such as your age, gender, hometown, and
              interests, that you voluntarily give to us when you register with
              the Service or when you choose to participate in various
              activities related to the Service, such as online chat and message
              boards.
            </li>
            <li>
              <strong>Derivative Data:</strong> Information our servers
              automatically collect when you access the Service, such as your IP
              address, your browser type, your operating system, your access
              times, and the pages you have viewed directly before and after
              accessing the Service.
            </li>
            <li>
              <strong>Financial Data:</strong> Financial information, such as
              data related to your payment method (e.g., valid credit card
              number, card brand, expiration date) that we may collect when you
              purchase, order, return, exchange, or request information about
              our services from the Service. We store only very limited, if any,
              financial information that we collect. Otherwise, all financial
              information is stored by our payment processor (e.g., Stripe), and
              you are encouraged to review their privacy policy and contact them
              directly for responses to your questions.
            </li>
            <li>
              <strong>Location Data:</strong> We may request access or
              permission to and track location-based information from your
              mobile device or browser, either continuously or while you are
              using the Service, to provide location-based services (like finding
              nearby food trucks). If you wish to change our access or
              permissions, you may do so in your device's or browser's settings.
            </li>
            <li>
              <strong>Order Information:</strong> Details about the orders you
              place, including items purchased, customization choices, delivery
              addresses, and fulfillment status.
            </li>
            <li>
              <strong>Food Truck Operator Data:</strong> Information provided by
              food truck operators, including business name, menu details,
              operating hours, location updates, and payout information (handled
              securely via our payment processor).
            </li>
          </ul>

          <h2 className="text-2xl font-semibold mt-6 mb-3">
            Use of Your Information
          </h2>
          <p>
            Having accurate information about you permits us to provide you with
            a smooth, efficient, and customized experience. Specifically, we may
            use information collected about you via the Service to:
          </p>
          <ul className="list-disc list-outside ml-6 space-y-2">
            <li>Create and manage your account.</li>
            <li>
              Process your orders and payments, and manage your transactions.
            </li>
            <li>Facilitate order fulfillment (pickup or delivery).</li>
            <li>
              Email you regarding your account or order confirmations and
              updates.
            </li>
            <li>
              Enable user-to-user communications (e.g., potentially contacting a
              truck about an order, if feature implemented).
            </li>
            <li>
              Monitor and analyze usage and trends to improve your experience
              with the Service.
            </li>
            <li>
              Notify you of updates to the Service or changes to our policies.
            </li>
            <li>
              Prevent fraudulent transactions, monitor against theft, and
              protect against criminal activity.
            </li>
            <li>Process payments and refunds.</li>
            <li>
              Respond to customer service requests and support needs.
            </li>
            <li>Compile anonymous statistical data and analysis for use internally or with third parties (in aggregated form).</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-6 mb-3">
            Disclosure of Your Information
          </h2>
          <p>
            We may share information we have collected about you in certain
            situations. Your information may be disclosed as follows:
          </p>
          <ul className="list-disc list-outside ml-6 space-y-2">
            <li>
              <strong>By Law or to Protect Rights:</strong> If we believe the
              release of information about you is necessary to respond to legal
              process, to investigate or remedy potential violations of our
              policies, or to protect the rights, property, and safety of
              others, we may share your information as permitted or required by
              any applicable law, rule, or regulation.
            </li>
            <li>
              <strong>Third-Party Service Providers:</strong> We may share your
              information with third parties that perform services for us or on
              our behalf, including payment processing (e.g., Stripe), data
              analysis, email delivery, hosting services, customer service, and
              mapping services (e.g., Mapbox).
            </li>
            <li>
              <strong>Food Truck Operators:</strong> When you place an order, we
              will share necessary information with the relevant food truck
              operator to fulfill your order. This includes your name (or first
              name/last initial), order details, special instructions, and, if
              delivery, your delivery address and potentially phone number.
            </li>
            <li>
              <strong>Business Transfers:</strong> We may share or transfer your
              information in connection with, or during negotiations of, any
              merger, sale of company assets, financing, or acquisition of all
              or a portion of our business to another company.
            </li>
             <li>
                <strong>With Your Consent:</strong> We may disclose your personal information for any other purpose with your consent.
            </li>
          </ul>
          <p>
            We do not sell your personal information to third parties.
          </p>


          <h2 className="text-2xl font-semibold mt-6 mb-3">
            Security of Your Information
          </h2>
          <p>
            We use administrative, technical, and physical security measures to
            help protect your personal information. While we have taken
            reasonable steps to secure the personal information you provide to
            us, please be aware that despite our efforts, no security measures
            are perfect or impenetrable, and no method of data transmission can
            be guaranteed against any interception or other type of misuse.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-3">
            Policy for Children
          </h2>
          <p>
            We do not knowingly solicit information from or market to children
            under the age of 13. If you become aware of any data we have
            collected from children under age 13, please contact us using the
            contact information provided below.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-3">
            Controls for Do-Not-Track Features
          </h2>
          <p>
            Most web browsers and some mobile operating systems include a
            Do-Not-Track (“DNT”) feature or setting you can activate to signal
            your privacy preference not to have data about your online browsing
            activities monitored and collected. No uniform technology standard
            for recognizing and implementing DNT signals has been finalized. As
            such, we do not currently respond to DNT browser signals or any
            other mechanism that automatically communicates your choice not to be
            tracked online.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-3">
            Changes to This Privacy Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time in order to
            reflect, for example, changes to our practices or for other
            operational, legal, or regulatory reasons. We will notify you of any
            changes by posting the new Privacy Policy on this page and updating
            the "Last Updated" date. You are advised to review this Privacy
            Policy periodically for any changes.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-3">Contact Us</h2>
          <p>
            If you have questions or comments about this Privacy Policy, please
            contact us at: [Your Contact Email Address] or via the Contact Us page.
            {/* Example using Link if Contact Us page exists */}
            {/* or via the <Link to="/contact" className="text-blue-600 hover:underline">Contact Us</Link> page. */}
          </p>
        </div>
      </div>
    </>
  );
};

export default UV_StaticPrivacy;