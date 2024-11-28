import Web3 from 'web3';
import CourseCertificationABI from './CourseCertificationABI.json';
import CertificateMinterABI from './CertificateMinterABI.json';

class CourseCertificationService {
    constructor() {
        this.web3 = null;
        this.courseCertificationContract = null;
        this.certificateMinterContract = null;
        this.account = null;
        this.isInitialized = false;
        this.chainId = null;
        
        // Configuration object
        this.config = {
            courseCertificationAddress: '0x87b4d12cb30534548e527df98552ec9393874453',
            certificateMinterAddress: '0xe94e2654e3aa863b76495259af4430f0a5d77bab', 
            rpcUrl: 'https://sepolia.infura.io/v3/ab7c969b633f41b8a1bde81b685a5142',
        };
    }

    setConfig(config) {
        this.config = { ...this.config, ...config };
    }

    async init() {
        if (this.isInitialized) return;
    
        try {
            
            // Always set up HTTP Provider first
            this.web3 = new Web3(new Web3.providers.HttpProvider(this.config.rpcUrl));
            
            // Try to connect to MetaMask if available
            if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
                try {
                    await window.ethereum.request({ method: 'eth_requestAccounts' });
                    this.web3 = new Web3(window.ethereum);
                    window.ethereum.enable();
                    console.log("MetaMask connected");
                    
                    const accounts = await this.web3.eth.getAccounts();
                    this.account = accounts[0];
                    console.log("Account:", this.account);
                    
                    this.chainId = await this.web3.eth.getChainId();
                    console.log("Chain ID:", this.chainId);
                } catch (walletError) {
                    console.log("Wallet connection failed, using HTTP Provider", walletError);
                    // Continue with HTTP Provider if wallet connection fails
                }
            } else {
                console.log("No wallet detected, using HTTP Provider");
            }
    
            this.courseCertificationContract = new this.web3.eth.Contract(
                CourseCertificationABI,
                this.config.courseCertificationAddress
            );
            console.log("Course Certification Contract initialized:");
            console.log(this.courseCertificationContract);
    
            this.certificateMinterContract = new this.web3.eth.Contract(
                CertificateMinterABI,
                this.config.certificateMinterAddress
            );
            console.log("Certificate Minter Contract initialized:");
            console.log(this.certificateMinterContract);
    
            this.isInitialized = true;
            console.log("Initialization complete");
    
        } catch (error) {
            console.error("Initialization error:", error);
            throw error;
        }
    }

    async getCourses() {
        await this.init();
        
        try {
            const courses = [];
            let courseId = 0;
            let baten = true;

            while (baten) {
                try {
                    try{
                        const course = await this.courseCertificationContract.methods.getCourseDetails(courseId).call();
                        console.log(course);
                        courses.push({
                            id: courseId,
                            name: course.name,
                            description: course.description,
                            trainerName: course.trainerName,
                            organization: course.organization,
                            startDate: new Date(parseInt(course.startDate) * 1000),
                            endDate: new Date(parseInt(course.endDate) * 1000),
                            durationInHours: parseInt(course.durationInHours),
                            active: course.active,
                            courseURI: course.courseURI
                        });

                    } catch(error){
                        console.log("WE ARE HERE DEEP");
                        baten=false;
                    }   
                    courseId++;
                } catch (error) {
                    if (error.message.includes("Invalid course ID")) {
                        console.log("Reached end of course list");
                        break;
                    } else {
                        console.error("Error fetching course details:", error);
                        throw error;
                    }
                }
            }

            return courses;
        } catch (error) {
            console.error("Failed to get courses:", error);
            throw error;
        }
    }

    async createCourse(courseData) {
        await this.init();
        const { courseName, description, trainerName, organization, startDate, endDate, durationInHours, courseURI } = courseData;

        try {
            const createCourseMethod = this.courseCertificationContract.methods.createCourse(
                courseName,
                description,
                trainerName,
                organization,
                Math.floor(new Date(startDate).getTime() / 1000),
                Math.floor(new Date(endDate).getTime() / 1000),
                durationInHours,
                courseURI
            );
            
            // Estimate the gas
            const gasEstimate = await createCourseMethod.estimateGas({ from: this.account });
            console.log("Estimated gas for createCourse:", gasEstimate);

            // Add a buffer to the estimated gas (e.g., 10% more)
            const gasLimit = Math.floor(Number(gasEstimate) * 1.1);
            console.log("Gas limit for createCourse:", gasLimit);

            // Send the transaction with the calculated gas limit
            const result = await createCourseMethod.send({ 
            from: this.account, 
            gas: gasLimit 
            });


            console.log("Course created successfully:", result);
            return result;

        } catch (error) {
            console.error("Failed to create course:", error);
            throw error;
        }
    }

    async getCourseDetails(courseId) {
        await this.init();
        try {
            const course = await this.courseCertificationContract.methods.getCourseDetails(courseId).call();
            return {
                id: courseId,
                name: course.name,
                description: course.description,
                trainerName: course.trainerName,
                organization: course.organization,
                startDate: new Date(parseInt(course.startDate) * 1000),
                endDate: new Date(parseInt(course.endDate) * 1000),
                durationInHours: parseInt(course.durationInHours),
                active: course.active,
                courseURI: course.courseURI
            };
        } catch (error) {
            console.error("Failed to get course details:", error);
            throw error;
        }
    }

    async updateCourse(courseData) {
        await this.init();
        const { editCourseId, courseName, description, trainerName, organization, startDate, endDate, durationInHours, editActive, courseURI } = courseData;

        try {
            await this.courseCertificationContract.methods.updateCourse(
                editCourseId,
                courseName,
                description,
                trainerName,
                organization,
                Math.floor(new Date(startDate).getTime() / 1000),
                Math.floor(new Date(endDate).getTime() / 1000),
                durationInHours,
                editActive === 'on',
                courseURI
            ).send({ from: this.account });
        } catch (error) {
            console.error("Failed to update course:", error);
            throw error;
        }
    }

    async issueCertificate(studentAddress, courseId) {
        await this.init();
        try {
            await this.courseCertificationContract.methods.issueCertificate(studentAddress, courseId)
                .send({ from: this.account });
        } catch (error) {
            console.error("Failed to issue certificate:", error);
            throw error;
        }
    }

    async verifyCertificate(studentAddress, courseId) {
        await this.init();
        try {
            const balance = await this.courseCertificationContract.methods.balanceOf(studentAddress, courseId).call();
            return balance > 0;
        } catch (error) {
            console.error("Failed to verify certificate:", error);
            throw error;
        }
    }

    async adminRecoverCertificate(courseId, from, to, reason) {
        await this.init();
        try {
            await this.certificateMinterContract.methods.adminRecoverCertificate(
                courseId, 
                from, 
                to,
                reason
            ).send({ from: this.account });
        } catch (error) {
            console.error("Failed to recover certificate:", error);
            throw error;
        }
    }

    async getTotalCertificates() {
        await this.init();
        try {
            // ERC1155Supply provides a total supply function
            const totalSupply = await this.courseCertificationContract.methods.totalSupply().call();
            return totalSupply;
        } catch (error) {
            console.error("Failed to get total certificates:", error);
            throw error;
        }
    }

    async getTotalStudents() {
        await this.init();
        try {
            // This is not directly available in the contract.
            // We'll need to calculate it based on the courses and certificates issued.
            const courses = await this.getCourses();
            const uniqueStudents = new Set();
            
            for (let course of courses) {
                const certificateHolders = await this.courseCertificationContract.methods.balanceOf(null, course.id).call();
                for (let holder of certificateHolders) {
                    uniqueStudents.add(holder);
                }
            }
            
            return uniqueStudents.size;
        } catch (error) {
            console.error("Failed to get total students:", error);
            throw error;
        }
    }

    async getCurrentSigner() {
        await this.init();
        try {
            const signer = await this.certificateMinterContract.methods.signer().call();
            console.log("WE DO GET THE CURRENT SIGNER");
            console.log(await this.certificateMinterContract.methods.signer().call());
            return signer;
        } catch (error) {
            console.error("Failed to get current signer:", error);
            throw error;
        }
    }

    async changeSigner(newSignerAddress) {
        await this.init();
        try {
            await this.certificateMinterContract.methods.setSigner(newSignerAddress)
                .send({ from: this.account });
        } catch (error) {
            console.error("Failed to change signer:", error);
            throw error;
        }
    }

    async generateMintingRequest(studentAddress, courseId) {
        await this.init();
        try {
            const nonce = await this.certificateMinterContract.methods.nonces(studentAddress).call();
            console.log(nonce);
            const messageHash = this.web3.utils.soliditySha3(
                {t: 'address', v: studentAddress},
                {t: 'uint256', v: courseId},
                {t: 'uint256', v: this.chainId},
                {t: 'uint256', v: nonce}
            );
            console.log(messageHash);
            // Sign the hash directly without the Ethereum prefix
            const signature = await this.web3.eth.personal.sign(
                messageHash,
                this.account,
                '' // MetaMask will ignore this parameter, but it's required for the method call
            );
            console.log(signature);
            return {
                studentAddress,
                courseId,
                nonce,
                signature
            };
        } catch (error) {
            console.error("Failed to generate minting request:", error);
            throw error;
        }
    }

    async getRecentCertificates(limit = 10) {
        await this.init();
        try {
            const events = await this.courseCertificationContract.getPastEvents('CertificateIssued', {
                fromBlock: 'latest',
                toBlock: 'latest'
            });

            return events.slice(0, limit).map(event => ({
                courseId: event.returnValues.courseId,
                studentAddress: event.returnValues.student,
                issuedAt: new Date(event.blockTimestamp * 1000)
            }));
        } catch (error) {
            console.error("Failed to get recent certificates:", error);
            throw error;
        }
    }

    async mintCertificate(studentAddress, courseId, signature) {
        await this.init();
        try {

            const nonce = await this.certificateMinterContract.methods.nonces(studentAddress).call();          
            // Call the mint function on the CertificateMinter contract
            console.log('Minting certificate with params:', { studentAddress, courseId, nonce, signature });
            
            const balance = await this.courseCertificationContract.methods.balanceOf(studentAddress, courseId).call();
            console.log('Current balance:', balance);
            
            const currentNonce = await this.certificateMinterContract.methods.nonces(studentAddress).call();
            console.log('Current nonce:', currentNonce);
                     
            const result = await this.certificateMinterContract.methods.mint(
                studentAddress,
                courseId,
                nonce,
                signature
            ).send({ from: this.account });

            console.log('Certificate minted successfully:', result);
            return result;
        } catch (error) {
            console.error("Failed to mint certificate:", error);
            throw error;
        }
    }
    async mintCertificate1(studentAddress, courseId, nonce, signature) {
        await this.init();
        try {
            console.log('Minting certificate with params:', { studentAddress, courseId, nonce, signature });
            
            const balance = await this.courseCertificationContract.methods.balanceOf(studentAddress, courseId).call();
            console.log('Current balance:', balance);
            
            const currentNonce = await this.certificateMinterContract.methods.nonces(studentAddress).call();
            console.log('Current nonce:', currentNonce);
            
            const result = await this.certificateMinterContract.methods.mint(
                studentAddress,
                courseId,
                nonce,
                signature
            ).send({ from: this.account });

            console.log('Certificate minted successfully:', result);
            return result;
        } catch (error) {
            console.error("Failed to mint certificate:", error);
            if (error.message.includes("revert")) {
                const revertReason = await this.web3.eth.call(error.receipt);
                console.error("Revert reason:", revertReason);
            }
            throw error;
        }
    }
    async addMinter(minterAddress) {
        await this.init();
        try {
            const result = await this.courseCertificationContract.methods.addMinter(minterAddress)
                .send({ from: this.account });
            console.log("Minter added successfully:", result);
            return result;
        } catch (error) {
            console.error("Failed to add minter:", error);
            throw error;
        }
    }
    
    async removeMinter(minterAddress) {
        await this.init();
        try {
            const result = await this.courseCertificationContract.methods.removeMinter(minterAddress)
                .send({ from: this.account });
            console.log("Minter removed successfully:", result);
            return result;
        } catch (error) {
            console.error("Failed to remove minter:", error);
            throw error;
        }
    }

    async verifyCertificateOwnership(studentAddress, courseId) {
        await this.init();
        try {
            // Check balance (existing check)
            const balance = await this.courseCertificationContract.methods.balanceOf(studentAddress, courseId).call();
            if (balance === 0) return false;
    
            // Get course details to check active status
            const courseDetails = await this.courseCertificationContract.methods.getCourseDetails(courseId).call();
            if (!courseDetails.active) return false;
    
            // Verify locked status (soulbound token check)
            const isLocked = await this.courseCertificationContract.methods.locked(courseId).call();
            
            return isLocked && balance > 0;
    
        } catch (error) {
            console.error("Failed to verify certificate ownership:", error);
            throw error;
        }
    }
}

export default new CourseCertificationService();