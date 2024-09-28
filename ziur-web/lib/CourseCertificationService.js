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
            courseCertificationAddress: '0xDaB0cA9e8a3Dad4BfE57D4Cd602F0d422113d630',
            certificateMinterAddress: '0xcc08d6d4657Bc5d92f26d69A38B2C59531afba21',
            rpcUrl: 'https://sepolia.infura.io/v3/ab7c969b633f41b8a1bde81b685a5142',
        };
    }

    setConfig(config) {
        this.config = { ...this.config, ...config };
    }

    async init() {
        if (this.isInitialized) return;

        if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
            try {
                // Request account access
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                this.web3 = new Web3(window.ethereum);
            } catch (error) {
                console.error("User denied account access or error occurred:", error);
                throw error;
            }
        } else {
            // Fallback to specified RPC URL if MetaMask is not available
            this.web3 = new Web3(new Web3.providers.HttpProvider(this.config.rpcUrl));
        }

        try {
            // Get the current account
            const accounts = await this.web3.eth.getAccounts();
            this.account = accounts[0];

            // Get the chain ID
            this.chainId = await this.web3.eth.getChainId();

            // Initialize contracts
            this.courseCertificationContract = new this.web3.eth.Contract(
                CourseCertificationABI,
                this.config.courseCertificationAddress
            );
            
            this.certificateMinterContract = new this.web3.eth.Contract(
                CertificateMinterABI,
                this.config.certificateMinterAddress
            );

            // Listen for account changes if using MetaMask
            if (window.ethereum) {
                window.ethereum.on('accountsChanged', (accounts) => {
                    this.account = accounts[0];
                });
                window.ethereum.on('chainChanged', (chainId) => {
                    this.chainId = chainId;
                });
            }

            this.isInitialized = true;

            console.log("Available methods:", Object.keys(this.courseCertificationContract.methods));
        } catch (error) {
            console.error("Failed to initialize Web3:", error);
            throw error;
        }
    }

    async getCourses() {
        await this.init();
        
        try {
            const courses = [];
            let courseId = 0;

            while (true) {
                try {
                    const course = await this.courseCertificationContract.methods.getCourseDetails(courseId).call();
                    courses.push({
                        id: courseId,
                        name: course.name,
                        description: course.description,
                        trainerName: course.trainerName,
                        startDate: new Date(parseInt(course.startDate) * 1000),
                        endDate: new Date(parseInt(course.endDate) * 1000),
                        durationInHours: parseInt(course.durationInHours),
                        active: course.active
                    });
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
        const { courseName, description, trainerName, startDate, endDate, durationInHours } = courseData;

        try {
            await this.courseCertificationContract.methods.createCourse(
                courseName,
                description,
                trainerName,
                Math.floor(new Date(startDate).getTime() / 1000),
                Math.floor(new Date(endDate).getTime() / 1000),
                durationInHours
            ).send({ from: this.account });
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
                startDate: new Date(parseInt(course.startDate) * 1000),
                endDate: new Date(parseInt(course.endDate) * 1000),
                durationInHours: parseInt(course.durationInHours),
                active: course.active
            };
        } catch (error) {
            console.error("Failed to get course details:", error);
            throw error;
        }
    }

    async updateCourse(courseData) {
        await this.init();
        const { editCourseId, courseName, description, trainerName, startDate, endDate, durationInHours, editActive } = courseData;

        try {
            await this.courseCertificationContract.methods.updateCourse(
                editCourseId,
                courseName,
                description,
                trainerName,
                Math.floor(new Date(startDate).getTime() / 1000),
                Math.floor(new Date(endDate).getTime() / 1000),
                durationInHours,
                editActive === 'on'  // Convert checkbox value to boolean
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

    async recoverCertificate(courseId, oldAddress, newAddress) {
        await this.init();
        try {
            await this.courseCertificationContract.methods.recover(courseId, oldAddress, newAddress)
                .send({ from: this.account });
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
            const messageHash = this.web3.utils.keccak256(
                ['address', 'uint256', 'uint256', 'uint256'],
                [studentAddress, courseId, this.chainId, nonce]
            );
            
            // Sign the hash directly without the Ethereum prefix
            const signature = await this.web3.eth.sign(messageHash, this.account);
            
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
}

export default new CourseCertificationService();