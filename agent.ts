import * as fs from 'fs';
import { generateContent, type AIProviderConfig } from './aiProvider.js';

export interface BPMNGenerationResponse {
    decision: string;
    explanation: string;
    bpmnXml: string;
}

const SYSTEM_INSTRUCTION = `You are a BPMN 2.0 Architect with explainable AI capabilities.
Convert process descriptions into valid BPMN 2.0 XML.
Include 'bpmndi' tags with X/Y coordinates for all elements.
You can use all BPMN 2.0 elements: as needed. (Events: Timer Message Error Escalation Conditional Signal Multiple Parallel Multiple Cancel Compensation Link Terminate Tasks User Manual Service Script Business Rule Send Receive Sub-process markers Loop Multi-Instance (Parallel, Sequential) Ad-Hoc Transaction Event Sub-Process, Data Object Data Input Data Output Data Store Data Association)

You MUST return a JSON response with the following structure:
{
    "decision": "A brief summary of the BPMN model created (e.g., 'Generated BPMN with 12 tasks, 3 gateways, 2 pools')",
    "explanation": "Detailed reasoning explaining: 1) How you interpreted the process description, 2) Key design decisions made (task types, gateway placements, lane assignments), 3) Any assumptions or inferences made from the input",
    "bpmnXml": "The complete valid BPMN 2.0 XML string"
}

Your explanation should help users understand WHY the model was structured this way.`;

export async function generateBPMN(
    processDescription: string,
    outputFile?: string,
    providerConfig?: AIProviderConfig
): Promise<BPMNGenerationResponse> {
    const config = providerConfig || { model: 'gemini', apiKey: '' };

    const result = await generateContent(
        config,
        `Process: ${processDescription}`,
        {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 1.0,
            responseFormat: 'json',
        }
    );

    const responseText = result.text;
    let parsedResponse: BPMNGenerationResponse;

    try {
        parsedResponse = JSON.parse(responseText.replace(/```json\n?|\n?```/g, ''));
    } catch (e) {
        // Fallback if JSON parsing fails - wrap raw XML in structured response
        parsedResponse = {
            decision: "BPMN model generated successfully",
            explanation: "The model was generated based on the provided process description. Unable to provide detailed explanation due to response format.",
            bpmnXml: responseText
        };
    }

    if (outputFile) {
        fs.writeFileSync(outputFile, parsedResponse.bpmnXml);
        console.log(`Success! File saved as '${outputFile}'`);
    }

    return parsedResponse;
}

// async function main() {
//     const description = fs.readFileSync('processLogic4.txt', 'utf-8');
//     await generateBPMN(description, 'cobit_dss.bpmn');
// }

// --- Usage ---
// const description = `
// A customer requests a refund. 
// A support agent reviews the request. 
// If the amount is under $50, it is auto-approved. 
// If over $50, a manager must approve it. 
// Finally, the accounting system processes the payment and the customer is notified.
// `;

// const description = `
// A customer submits an online enterprise software subscription order.
// The e-commerce system validates customer identity and account status.
// The system checks product availability and licensing constraints.
// The pricing engine calculates contract pricing and discounts.
// The system applies regional taxes and compliance rules.
// The customer reviews the final quote and confirms the order.
// The order management system creates a sales order.
// The CRM system links the order to the customer record.
// The payment gateway performs fraud detection checks.
// If fraud risk is high, the order is placed on hold.
// If fraud risk is low, payment authorization is requested.
// The bank authorizes or declines the payment.
// If payment is declined, the customer is notified and the order is canceled.
// If payment is authorized, the order proceeds to fulfillment.
// The provisioning system allocates software licenses.
// The system schedules service activation.
// The activation team configures the customer environment.
// Automated tests verify the configuration.
// If tests fail, a technical incident is created.
// If tests pass, the service is activated.
// The billing system generates the initial invoice.
// The invoice is posted to the accounting system.
// Revenue recognition rules are applied.
// The compliance system logs the transaction for audit.
// A confirmation email is sent to the customer.
// The customer onboarding team is notified.
// The customer receives onboarding documentation.
// Usage monitoring is enabled.
// The customer support system opens a welcome case.
// The order lifecycle is marked as completed.
// `;

// const description = `
// (Order is submitted) (Start Event)

// (Validate customer identity and account) (Service Task – System)

// (Check product availability and license constraints) (Service Task – System)

// (Calculate pricing and discounts) (Service Task – Pricing Engine)

// (Apply taxes and regulatory compliance) (Service Task – Compliance System)

// (Present quote to customer) (Send Task – Message to Customer Pool)

// (Customer reviews and accepts quote) (User Task – Customer Pool)

// (Create sales order) (Service Task – Order Management System)

// (Link order to CRM record) (Service Task – CRM System)

// (Perform fraud risk assessment) (Service Task – Fraud Detection System)

// (Fraud risk evaluated) (Exclusive Gateway)

// (Place order on hold for manual review) (User Task – Risk Team)

// (Resolve fraud review) (Exclusive Gateway – Approved / Rejected)

// (Notify customer of rejection) (Send Task – Message to Customer Pool)

// (Order rejected) (End Event)

// (Request payment authorization) (Service Task – Payment Gateway)

// (Payment authorization result) (Exclusive Gateway)

// (Notify customer of payment failure) (Send Task – Message to Customer Pool)

// (Cancel order) (Service Task – Order Management System)

// (Order cancelled) (End Event)

// (Allocate software licenses) (Service Task – Provisioning System)

// (Schedule service activation) (Service Task – Provisioning System)

// (Configure customer environment) (Subprocess – Technical Setup)

// (Run automated configuration tests) (Service Task – Testing System)

// (Test results evaluated) (Exclusive Gateway)

// (Create technical incident) (Service Task – ITSM System)

// (Incident handling started) (End Event – Escalation)

// (Activate customer service) (Service Task – Production System)

// (Generate initial invoice) (Service Task – Billing System)

// (Post invoice to accounting) (Service Task – Accounting System)

// (Apply revenue recognition rules) (Service Task – Finance System)

// (Log transaction for audit) (Service Task – Audit System)

// (Send order confirmation) (Send Task – Message to Customer Pool)

// (Notify onboarding team) (Send Task – Message to Internal Pool)

// (Deliver onboarding documentation) (Send Task – Message to Customer Pool)

// (Enable usage monitoring) (Service Task – Monitoring System)

// (Open customer welcome support case) (Service Task – Support System)

// (Order lifecycle completed) (End Event)
// `;

// const description = `
// (Order is submitted by customer) (Start Event – Message Start – Customer Pool → Company Pool)

// (Receive order request) (Message Catch Event – Company Pool)

// (Validate customer identity and account status) (Service Task – Internal System Lane)

// (Check product availability and license constraints) (Service Task – Product System Lane)

// (Calculate pricing and discounts) (Service Task – Pricing Engine Lane)

// (Apply taxes and regulatory rules) (Service Task – Compliance System Lane)

// (Send final quote to customer) (Send Task – Message Flow to Customer Pool)

// (Customer reviews and accepts quote) (User Task – Customer Pool)

// (Customer acceptance received) (Message Catch Event – Company Pool)

// (Create sales order) (Service Task – Order Management Lane)

// (Link order to CRM record) (Service Task – CRM Lane)

// (Perform fraud risk assessment) (Service Task – Fraud Detection Lane)

// (Evaluate fraud risk result) (Exclusive Gateway – Default flow = Low Risk)

// (Place order on hold for manual fraud review) (User Task – Risk Team Lane)

// (Fraud review decision) (Exclusive Gateway – Approved / Rejected, Default = Approved)

// (Send rejection notice to customer) (Send Task – Message Flow to Customer Pool)

// (Order rejected) (End Event – Terminate)

// (Request payment authorization) (Service Task – Payment Gateway Lane)

// (Evaluate payment authorization result) (Exclusive Gateway – Approved / Declined, Default = Declined)

// (Notify customer of payment failure) (Send Task – Message Flow to Customer Pool)

// (Cancel order) (Service Task – Order Management Lane)

// (Order cancelled) (End Event – Terminate)

// (Allocate software licenses) (Service Task – Provisioning System Lane)

// (Schedule service activation) (Service Task – Provisioning System Lane)

// (Configure customer environment) (Subprocess – Technical Setup Lane)

// (Run automated configuration tests) (Service Task – Testing System Lane)

// (Evaluate test results) (Exclusive Gateway – Pass / Fail, Default = Pass)

// (Create technical incident) (Service Task – ITSM System Lane)

// (Incident escalated to operations) (End Event – Escalation)

// (Activate customer service) (Service Task – Production System Lane)

// (Generate initial invoice) (Service Task – Billing System Lane)

// (Post invoice to accounting) (Service Task – Accounting System Lane)

// (Apply revenue recognition rules) (Service Task – Finance Lane)

// (Log transaction for audit) (Service Task – Audit System Lane)

// (Send order confirmation to customer) (Send Task – Message Flow to Customer Pool)

// (Notify onboarding team) (Send Task – Message Flow to Internal Onboarding Pool)

// (Deliver onboarding documentation) (Send Task – Message Flow to Customer Pool)

// (Enable usage monitoring) (Service Task – Monitoring System Lane)

// (Open welcome support case) (Service Task – Support System Lane)

// (Order lifecycle completed successfully) (End Event – None)
// `;

// const description = `
// A customer sends an order request. (Message Start Event – Customer → Company)
// The system receives the order request. (Message Start Event – Company Process)
// The system validates customer identity and account status. (Service Task)
// The system checks product availability and license constraints. (Service Task)
// The system calculates pricing and discounts. (Service Task)
// The system applies taxes and regulatory compliance rules. (Service Task)
// The system sends a quote to the customer. (Send Task – Message Flow to Customer)
// The customer receives the quote. (Message Intermediate Catch Event – Customer Process)
// The customer reviews the quote. (User Task – Customer)
// The customer sends quote acceptance. (Send Task – Customer → Company)
// The system receives quote acceptance. (Message Intermediate Catch Event – Company)
// The system creates a sales order. (Service Task)
// The system links the order to the CRM record. (Service Task)
// The system performs fraud risk assessment. (Service Task)
// Fraud risk is evaluated. (Exclusive Gateway)
// If fraud risk is high, the order is sent for manual review. (User Task)
// The reviewer decides to approve or reject the order. (Exclusive Gateway)
// If rejected, the system notifies the customer and ends the process. (Send Task → End Event)
// If approved or no fraud risk, the flow continues. (Exclusive Gateway – Merge)
// The system requests payment authorization. (Service Task)
// Payment authorization result is evaluated. (Exclusive Gateway)
// If payment fails, the customer is notified and the order is canceled. (Send Task → Service Task → End Event)
// If payment succeeds, licenses are allocated. (Service Task)
// The system schedules service activation. (Service Task)
// The system configures the customer environment. (Expanded Sub-Process)
// The system runs automated configuration tests. (Service Task)
// Test results are evaluated. (Exclusive Gateway)
// If tests fail, a technical incident is created and the process ends. (Service Task → End Event)
// If tests pass, the service is activated. (Service Task)
// The system generates the initial invoice. (Service Task)
// The system posts the invoice to accounting. (Service Task)
// The system applies revenue recognition rules. (Service Task)
// The system logs the transaction for audit purposes. (Service Task)
// The system sends order confirmation to the customer. (Send Task)
// The onboarding team is notified. (Send Task)
// Onboarding documentation is delivered to the customer. (Send Task)
// Usage monitoring is enabled. (Service Task)
// A welcome support case is opened. (Service Task)
// The order lifecycle is completed. (End Event)
// `;

// napraviti agenta da iz teksta pravi ovakve specificne tesktove

// const description = `
// A customer sends an order request.
// (Message Flow from Send Task: Send Order Request in Customer / Customer User lane → Message Start Event: Receive Order Request in Company / Sales lane)

// The company sales system receives the order request.
// (Message Start Event in Company / Sales lane)

// The system validates customer identity and account status against CRM and IAM systems.
// (Service Task in Company / Sales lane)

// The system checks product availability and licensing constraints in the product catalog.
// (Service Task in Company / Sales lane)

// The system calculates contract pricing, volume discounts, and promotional adjustments.
// (Service Task in Company / Sales lane)

// The system applies regional taxes and regulatory compliance rules.
// (Service Task in Company / Sales lane)

// The company sends a commercial quote to the customer.
// (Send Task in Company / Sales lane → Message Flow → Intermediate Message Catch Event: Receive Quote in Customer / Customer User lane)

// The customer receives the quote.
// (Intermediate Message Catch Event in Customer / Customer User lane)

// The customer reviews the quote terms and pricing.
// (User Task in Customer / Customer User lane)

// The customer sends order acceptance.
// (Send Task in Customer / Customer User lane → Message Flow → Intermediate Message Catch Event: Receive Acceptance in Company / Sales lane)

// The company receives the order acceptance.
// (Intermediate Message Catch Event in Company / Sales lane)

// The system creates a sales order in the ERP system.
// (Service Task in Company / Sales lane)

// The system links the sales order to the customer record in CRM.
// (Service Task in Company / Sales lane)

// The system performs automated fraud and risk assessment.
// (Service Task in Company / Risk & Compliance lane)

// The system evaluates fraud risk level.
// (Exclusive Gateway in Company / Risk & Compliance lane)

// If fraud risk is high, the order is routed for manual review.
// (Sequence Flow → User Task in Company / Risk & Compliance lane)

// A compliance analyst reviews the order.
// (User Task in Company / Risk & Compliance lane)

// The analyst decides whether to approve the order.
// (Exclusive Gateway in Company / Risk & Compliance lane)

// If the order is rejected, the company notifies the customer of rejection.
// (Send Task in Company / Risk & Compliance lane → Message Flow → Intermediate Message Catch Event: Receive Rejection in Customer / Customer User lane)

// If fraud risk is low or the order is approved, the process continues to payment.
// (Exclusive Gateway merge in Company / Risk & Compliance lane)

// The system requests payment authorization from the payment provider.
// (Service Task in Company / Finance lane)

// The system evaluates the payment authorization result.
// (Exclusive Gateway in Company / Finance lane)

// If payment authorization fails, the company notifies the customer of payment failure.
// (Send Task in Company / Finance lane → Message Flow → Intermediate Message Catch Event: Receive Payment Failure in Customer / Customer User lane)

// If payment fails, the system cancels the sales order.
// (Service Task in Company / Finance lane)

// If payment authorization succeeds, licenses are allocated.
// (Service Task in Company / Operations / Provisioning lane)

// The system schedules service activation.
// (Service Task in Company / Operations / Provisioning lane)

// The system configures the customer environment.
// (Expanded Sub-Process in Company / Operations / Provisioning lane)

// The system runs automated configuration and smoke tests.
// (Service Task in Company / Operations / Provisioning lane)

// The system evaluates test results.
// (Exclusive Gateway in Company / Operations / Provisioning lane)

// If tests fail, a technical incident is created.
// (Service Task in Company / Operations / Provisioning lane)

// If tests pass, the service is activated.
// (Service Task in Company / Operations / Provisioning lane)

// The system generates the initial customer invoice.
// (Service Task in Company / Finance lane)

// The invoice is posted to the accounting system.
// (Service Task in Company / Finance lane)

// Revenue recognition rules are applied.
// (Service Task in Company / Finance lane)

// The transaction is logged for audit and compliance.
// (Service Task in Company / Customer Success / IT Ops lane)

// The company sends service confirmation to the customer.
// (Send Task in Company / Customer Success / IT Ops lane → Message Flow → Intermediate Message Catch Event: Receive Confirmation in Customer / Customer User lane)

// The company notifies the onboarding team.
// (Send Task in Company / Customer Success / IT Ops lane)

// The company delivers onboarding documentation to the customer.
// (Send Task in Company / Customer Success / IT Ops lane → Message Flow → Intermediate Message Catch Event: Receive Documentation in Customer / Customer User lane)

// The system enables usage monitoring.
// (Service Task in Company / Customer Success / IT Ops lane)

// The system opens a welcome support case.
// (Service Task in Company / Customer Success / IT Ops lane)

// The order lifecycle is completed.
// (End Event in Company / Customer Success / IT Ops lane)
// `;

const  description = fs.readFileSync('processLogic4.txt', 'utf-8');

generateBPMN(description);